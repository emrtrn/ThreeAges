interface ActiveProjectResponse {
  manifest: {
    name: string;
    type: string;
    version: string;
  };
  manifestPath: string;
  rootName: string;
}

interface RecentProject {
  name: string;
  projectManifest: string;
}

export class ProjectLauncher {
  private readonly root: HTMLDivElement;
  private readonly status: HTMLDivElement;
  private readonly recentList: HTMLDivElement;
  private readonly activeName: HTMLElement;
  private readonly activePath: HTMLElement;

  constructor() {
    document.body.classList.add("launcher-mode");
    this.root = document.createElement("div");
    this.root.className = "launcher-shell";
    this.root.innerHTML = `
      <main class="launcher-main">
        <section class="launcher-heading">
          <div>
            <h1>3DGameDev</h1>
            <p>Three.js project browser</p>
          </div>
          <button type="button" class="primary" data-action="open-editor">Open Editor</button>
        </section>

        <section class="launcher-grid">
          <article class="launcher-panel">
            <h2>Active Project</h2>
            <div class="project-summary">
              <strong data-active-name>Loading</strong>
              <span data-active-path></span>
            </div>
          </article>

          <article class="launcher-panel">
            <h2>New Project</h2>
            <label>
              <span>Template</span>
              <select data-new-template>
                <option value="basic-three-project">basic-three-project</option>
                <option value="home-makeover-like">home-makeover-like</option>
              </select>
            </label>
            <label>
              <span>Target Path</span>
              <div class="path-picker">
                <input data-new-path placeholder="C:\\Users\\emret\\Desktop\\my-game" />
                <button type="button" data-action="browse-new-path">Browse...</button>
              </div>
            </label>
            <button type="button" data-action="new-project">Create Project</button>
          </article>

          <article class="launcher-panel">
            <h2>Open Project</h2>
            <label>
              <span>Project Folder or Manifest</span>
              <div class="path-picker">
                <input data-open-path placeholder="C:\\Users\\emret\\Desktop\\home-makeover" />
                <button type="button" data-action="browse-open-path">Browse...</button>
              </div>
            </label>
            <button type="button" data-action="open-project">Set Active Project</button>
          </article>

          <article class="launcher-panel">
            <h2>Package</h2>
            <label>
              <span>Project Folder or Manifest</span>
              <div class="path-picker">
                <input data-package-path placeholder="Leave empty for active project" />
                <button type="button" data-action="browse-package-path">Browse...</button>
              </div>
            </label>
            <button type="button" data-action="package-project">Package Web Build</button>
          </article>
        </section>

        <section class="launcher-panel">
          <h2>Recent Projects</h2>
          <div class="recent-list" data-recent-list></div>
        </section>

        <footer class="launcher-status" data-status>Ready</footer>
      </main>
    `;

    const overlay = document.getElementById("ui-overlay");
    if (!overlay) throw new Error("Missing #ui-overlay");
    overlay.append(this.root);

    this.status = requireElement(this.root, "[data-status]");
    this.recentList = requireElement(this.root, "[data-recent-list]");
    this.activeName = requireElement(this.root, "[data-active-name]");
    this.activePath = requireElement(this.root, "[data-active-path]");

    this.bindActions();
    void this.refresh();
  }

  private bindActions(): void {
    this.root.querySelector("[data-action='open-editor']")?.addEventListener("click", () => {
      location.href = "/?editor&debug";
    });

    this.root.querySelector("[data-action='new-project']")?.addEventListener("click", () => {
      const template = valueOf(this.root, "[data-new-template]");
      const targetPath = valueOf(this.root, "[data-new-path]");
      void this.postAction("/__studio/new", { template, targetPath });
    });

    this.root.querySelector("[data-action='open-project']")?.addEventListener("click", () => {
      const projectPath = valueOf(this.root, "[data-open-path]");
      void this.postAction("/__studio/open", { projectPath });
    });

    this.root.querySelector("[data-action='package-project']")?.addEventListener("click", () => {
      const projectPath = valueOf(this.root, "[data-package-path]");
      void this.postAction("/__studio/package", { projectPath });
    });

    this.root.querySelector("[data-action='browse-new-path']")?.addEventListener("click", () => {
      void this.pickDirectory("[data-new-path]", "Choose a folder for the new project");
    });
    this.root.querySelector("[data-action='browse-open-path']")?.addEventListener("click", () => {
      void this.pickDirectory("[data-open-path]", "Choose a project folder");
    });
    this.root.querySelector("[data-action='browse-package-path']")?.addEventListener("click", () => {
      void this.pickDirectory("[data-package-path]", "Choose a project folder to package");
    });
  }

  private async pickDirectory(inputSelector: string, title: string): Promise<void> {
    this.setStatus("Opening folder picker...");
    const response = await fetch("/__select-directory", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    });
    const body = (await response.json().catch(() => ({}))) as {
      ok?: boolean;
      path?: string;
      cancelled?: boolean;
      error?: string;
    };
    if (!response.ok || !body.ok) {
      if (body.cancelled) {
        this.setStatus("Folder selection cancelled.");
        return;
      }
      this.setStatus(body.error ?? `Folder picker failed: ${response.status}`, "error");
      return;
    }
    const input = this.root.querySelector<HTMLInputElement>(inputSelector);
    if (input && body.path) input.value = body.path;
    this.setStatus("Folder selected.", "success");
  }

  private async refresh(): Promise<void> {
    const active = await fetchJson<ActiveProjectResponse>("/__project");
    this.activeName.textContent = `${active.manifest.name} (${active.manifest.type})`;
    this.activePath.textContent = active.manifestPath;
    const packageInput = this.root.querySelector<HTMLInputElement>("[data-package-path]");
    if (packageInput) packageInput.placeholder = active.manifestPath;

    const recent = await fetchJson<{ projects: RecentProject[] }>("/__recent-projects");
    this.recentList.replaceChildren(
      ...recent.projects.map((project) => this.createRecentProject(project)),
    );
  }

  private createRecentProject(project: RecentProject): HTMLElement {
    const row = document.createElement("button");
    row.type = "button";
    row.className = "recent-project";
    row.innerHTML = `
      <strong>${project.name}</strong>
      <span>${project.projectManifest}</span>
    `;
    row.addEventListener("click", () => {
      void this.postAction("/__studio/open", { projectPath: project.projectManifest });
    });
    return row;
  }

  private async postAction(url: string, payload: Record<string, string>): Promise<void> {
    this.setStatus("Working...");
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const body = (await response.json().catch(() => ({}))) as {
      ok?: boolean;
      output?: string;
      error?: string;
    };
    if (!response.ok || !body.ok) {
      this.setStatus(body.error ?? `Request failed: ${response.status}`, "error");
      return;
    }
    this.setStatus(body.output?.trim() || "Done", "success");
    await this.refresh();
  }

  private setStatus(message: string, tone: "info" | "success" | "error" = "info"): void {
    this.status.textContent = message;
    this.status.dataset.tone = tone;
  }
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url} failed: ${response.status}`);
  return (await response.json()) as T;
}

function requireElement<T extends HTMLElement>(root: ParentNode, selector: string): T {
  const element = root.querySelector(selector);
  if (!element) throw new Error(`Missing launcher element: ${selector}`);
  return element as T;
}

function valueOf(root: ParentNode, selector: string): string {
  const input = root.querySelector<HTMLInputElement | HTMLSelectElement>(selector);
  return input?.value.trim() ?? "";
}
