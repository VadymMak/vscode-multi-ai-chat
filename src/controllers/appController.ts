import * as vscode from "vscode";
import DataService from "../services/dataService"; // ✅
import AuthManager from "../auth/authManager"; // ✅
import logger from "../utils/logger"; // ✅
import AIProvider from "../providers/aiProvider"; // ✅
// Main application controller class
export class AppController {
  private static instance: AppController;
  private dataService: DataService;
  private authManager: AuthManager;
  private aiProvider: AIProvider;

  private constructor() {
    this.dataService = DataService.getInstance();
    this.authManager = AuthManager.getInstance();
    this.aiProvider = new AIProvider();
  }

  // Singleton pattern to ensure only one instance of AppController
  public static getInstance(): AppController {
    if (!AppController.instance) {
      AppController.instance = new AppController();
    }
    return AppController.instance;
  }

  // Initialize the application
  public async initialize(context: vscode.ExtensionContext): Promise<void> {
    try {
      logger.info("Initializing AppController...");

      await this.dataService.initialize();
      this.registerCommands(context);
      logger.info("AppController initialized successfully.");
    } catch (error) {
      logger.error("Failed to initialize AppController", error as Error); // ✅
    }
  }

  // Register VS Code commands
  private registerCommands(context: vscode.ExtensionContext): void {
    const disposable = vscode.commands.registerCommand(
      "vscode-multi-ai-chat.start",
      async () => {
        logger.info('Command "vscode-multi-ai-chat.start" executed.');
        try {
          const response = await this.aiProvider.getAIResponse("Hello AI!");
          vscode.window.showInformationMessage(`AI Response: ${response}`);
        } catch (error) {
          logger.error("Error executing command", error as Error);
          vscode.window.showErrorMessage(
            "An error occurred while executing the command."
          );
        }
      }
    );

    context.subscriptions.push(disposable);
  }
}
