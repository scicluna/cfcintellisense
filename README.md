# CFC-Intellisense
This extension provides enhanced support for ColdFusion development in Visual Studio Code, IntelliSense for cfc methods and hover-over descriptions for cfc methods.

## Features
IntelliSense: Offers method suggestions and auto-completions for ColdFusion components.
Hover Descriptions: Displays method signatures and descriptions when hovering over method calls.
CFC Methods Parsing: Dynamically parses CFC files to provide up-to-date method signatures and documentation.

## Installation
To install the extension, follow these steps:

You can download the extension package (.vsix file) and install it manually via the command line:
- Clone the repo
- ``npm i`` to install dependencies
- ``npm run package`` to get the vsix file
- Then right click the three dots on your vscode extension tab and "install from vsix"

## Usage
Once installed, the extension will automatically activate when you open a ColdFusion file (.cfm or .cfc). You can start typing to see IntelliSense in action, or hover over existing method calls to view their descriptions. 

**Only supports cfc methods at this time, and only in cfscript.**

## Contributing
Contributions to the extension are welcome! Here's how you can contribute:

- Report Issues: If you find a bug or have a suggestion, please open an issue on our GitHub repository.
- Submit Pull Requests: Feel free to fork the repository and submit pull requests with bug fixes or new features.

## Development Setup
For developers looking to contribute or customize the extension, here's how to set up a development environment:
- Clone the repository: git clone https://github.com/scicluna/cfcintellisense.git
- Open the project folder in VS Code.
- Run npm install to install dependencies.
- Press F5 to open a new VS Code window with your extension loaded.

## License
This project is licensed under the MIT License - see the LICENSE file for details.