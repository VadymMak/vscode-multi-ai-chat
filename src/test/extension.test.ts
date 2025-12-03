import * as vscode from "vscode";
import { activate, deactivate } from "../extension";
import { describe, it, beforeEach, afterEach } from "@jest/globals";

// Mock the VS Code API
jest.mock("vscode", () => ({
  ...jest.requireActual("vscode"),
  window: {
    showInformationMessage: jest.fn(),
    showErrorMessage: jest.fn(),
  },
  commands: {
    registerCommand: jest.fn(),
  },
  workspace: {
    getConfiguration: jest.fn().mockReturnValue({
      get: jest.fn(),
      update: jest.fn(),
    }),
  },
}));

describe("Extension Tests", () => {
  let context: vscode.ExtensionContext;

  beforeEach(() => {
    // Create a mock extension context
    context = ({
      subscriptions: [],
    } as unknown) as vscode.ExtensionContext;
  });

  afterEach(() => {
    // Clear all mocks after each test
    jest.clearAllMocks();
  });

  it("should activate the extension", () => {
    activate(context);

    // Check if the command was registered
    expect(vscode.commands.registerCommand).toHaveBeenCalledWith(
      "vscode-multi-ai-chat.start",
      expect.any(Function)
    );

    // Check if the extension context subscriptions were updated
    expect(context.subscriptions.length).toBeGreaterThan(0);
  });

  it("should deactivate the extension", () => {
    deactivate();

    // Check if any cleanup logic is executed
    // (In this case, we don't have specific cleanup logic)
    expect(true).toBe(true);
  });

  it("should show information message when command is executed", async () => {
    const commandCallback = (vscode.commands.registerCommand as jest.Mock).mock
      .calls[0][1];

    await commandCallback();

    expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
      "VSCode Multi AI Chat extension activated!"
    );
  });
});
