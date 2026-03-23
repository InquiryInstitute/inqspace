"use strict";

const vscode = require("vscode");
const WebSocket = require("ws");

/** @type {WebSocket | null} */
let ws = null;

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
  const config = vscode.workspace.getConfiguration("aipaLecturer");
  const url = config.get("ideCommandWebSocketUrl");
  if (!url || typeof url !== "string" || url.length === 0) {
    vscode.window.showInformationMessage(
      "AIPA Lecturer Bridge: set aipaLecturer.ideCommandWebSocketUrl in Settings to enable IDE channel."
    );
    return;
  }

  try {
    ws = new WebSocket(url);
  } catch (e) {
    vscode.window.showErrorMessage(`AIPA Lecturer Bridge: ${e.message}`);
    return;
  }

  ws.on("open", () => {
    vscode.window.setStatusBarMessage("AIPA Lecturer IDE channel connected", 5000);
  });

  ws.on("message", async (data) => {
    let msg;
    try {
      msg = JSON.parse(data.toString());
    } catch {
      return;
    }
    if (msg.channel && msg.channel !== "ide") {
      return;
    }
    if (msg.op === "executeCommand" && typeof msg.command === "string") {
      const args = Array.isArray(msg.args) ? msg.args : [];
      try {
        await vscode.commands.executeCommand(msg.command, ...args);
      } catch (err) {
        vscode.window.showWarningMessage(`Lecturer command failed: ${err.message}`);
      }
      return;
    }
    if (msg.op === "terminalSendText" && typeof msg.text === "string") {
      const addNewLine = msg.addNewLine !== false;
      try {
        await vscode.commands.executeCommand("workbench.action.terminal.focus");
      } catch {
        /* ignore */
      }
      await new Promise(function (resolve) {
        setTimeout(resolve, 200);
      });
      let term = vscode.window.activeTerminal;
      if (!term && vscode.window.terminals.length > 0) {
        term = vscode.window.terminals[vscode.window.terminals.length - 1];
      }
      if (term) {
        term.show(false);
        term.sendText(msg.text, addNewLine);
      } else {
        vscode.window.showWarningMessage(
          "AIPA Lecturer: no terminal — open one first (e.g. workbench.action.terminal.new)."
        );
      }
    }
  });

  ws.on("error", (err) => {
    vscode.window.showErrorMessage(`AIPA Lecturer WebSocket: ${err.message}`);
  });

  context.subscriptions.push({
    dispose: () => {
      if (ws) {
        ws.close();
        ws = null;
      }
    },
  });
}

function deactivate() {
  if (ws) {
    ws.close();
    ws = null;
  }
}

module.exports = { activate, deactivate };
