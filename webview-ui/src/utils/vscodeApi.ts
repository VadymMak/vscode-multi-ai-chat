// ✅ VS Code API Singleton
// This ensures acquireVsCodeApi() is called only ONCE

declare function acquireVsCodeApi(): {
  postMessage: (message: any) => void;
  getState: () => any;
  setState: (state: any) => void;
};

class VSCodeAPIWrapper {
  private static instance: VSCodeAPIWrapper;
  private vscodeApi: ReturnType<typeof acquireVsCodeApi> | undefined;

  private constructor() {
    try {
      // ✅ Call acquireVsCodeApi() ONLY ONCE
      this.vscodeApi = acquireVsCodeApi();
      console.log("✅ [VSCodeAPI] API acquired successfully");
    } catch (error) {
      console.log("❌ [VSCodeAPI] Not running in VS Code webview");
      this.vscodeApi = undefined;
    }
  }

  public static getInstance(): VSCodeAPIWrapper {
    if (!VSCodeAPIWrapper.instance) {
      VSCodeAPIWrapper.instance = new VSCodeAPIWrapper();
    }
    return VSCodeAPIWrapper.instance;
  }

  public getAPI(): ReturnType<typeof acquireVsCodeApi> | undefined {
    return this.vscodeApi;
  }

  public postMessage(message: any): void {
    if (this.vscodeApi) {
      this.vscodeApi.postMessage(message);
    } else {
      console.warn("⚠️ [VSCodeAPI] Cannot post message - API not available");
    }
  }

  public getState(): any {
    if (this.vscodeApi) {
      return this.vscodeApi.getState();
    }
    return null;
  }

  public setState(state: any): void {
    if (this.vscodeApi) {
      this.vscodeApi.setState(state);
    }
  }
}

// ✅ Export singleton instance
export const vscodeAPI = VSCodeAPIWrapper.getInstance();
