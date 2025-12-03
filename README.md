# VSCode Multi-AI Chat Extension

Welcome to the VSCode Multi-AI Chat Extension! This project is designed to integrate multiple AI chat functionalities directly into your Visual Studio Code environment. It leverages TypeScript, React, Node.js, the VS Code API, Vite, and Webpack to provide a seamless and efficient experience.

## Features

- **Multi-AI Integration**: Connect with various AI providers for diverse chat capabilities.
- **Authentication Management**: Secure access with a robust authentication system.
- **Customizable UI**: Tailor the chat interface to your preferences.
- **Real-time Communication**: Engage in live chat sessions with AI models.
- **VS Code Panel Integration**: Access the chat directly from a VS Code panel.

## Getting Started

### Prerequisites

- **Node.js**: Ensure you have Node.js installed (version 18.x or later).
- **VS Code**: Install Visual Studio Code.

### Installation

1. **Clone the Repository**:

   ```bash
   git clone https://github.com/yourusername/vscode-multi-ai-chat.git
   cd vscode-multi-ai-chat
   ```

2. **Install Dependencies**:

   ```bash
   npm install
   ```

3. **Compile the Project**:

   ```bash
   npm run compile
   ```

4. **Build the Webview**:

   ```bash
   npm run build:webview
   ```

5. **Package the Extension**:

   ```bash
   npm run package
   ```

6. **Run Tests**:
   ```bash
   npm test
   ```

### Usage

- **Launch the Extension**: Open the project in VS Code and press `F5` to start the extension in a new VS Code window.
- **Open the Chat Panel**: Use the command palette (`Ctrl+Shift+P` or `Cmd+Shift+P` on macOS) and search for "Open AI Chat Panel" to start interacting with the AI.

## Project Structure

The project is organized into several groups, each serving a specific purpose:

- **Foundation**: Core types, error handling, constants, configuration, and utilities.
- **Core Logic**: Models, authentication, API client, AI provider, and data services.
- **Integration**: Controllers, panels, and the extension entry point.
- **UI Foundation**: Frontend types, utilities, and API services.
- **UI Components**: React components and hooks for the user interface.
- **Styling**: Global and application-specific styles.
- **Webview Configuration**: Setup for the frontend using Vite.
- **Root Configuration**: Overall project setup and build configurations.
- **Tooling**: Development tools and ignore rules.
- **Documentation**: Project documentation and setup instructions.

## Development

### Building

- **Development Build**:

  ```bash
  npm run build:dev
  ```

- **Production Build**:
  ```bash
  npm run build
  ```

### Testing

- **Run Unit Tests**:
  ```bash
  npm test
  ```

### Linting

- **Run Linter**:
  ```bash
  npm run lint
  ```

## Contributing

Contributions are welcome! Please fork the repository and submit a pull request with your changes. Ensure that your code adheres to the project's coding standards and passes all tests.

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

## Acknowledgments

- **VS Code API**: For providing the platform to build this extension.
- **OpenAI**: For the AI models and APIs used in this project.
- **Community Contributors**: For their valuable input and feedback.

For more information, please refer to the official [documentation](https://code.visualstudio.com/api) for developing VS Code extensions.
