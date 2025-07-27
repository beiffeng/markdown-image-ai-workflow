import * as vscode from 'vscode';

/**
 * 文档位置安全计算工具函数
 */
export function clampLineNumber(line: number, document: vscode.TextDocument): number {
  return Math.max(0, Math.min(line, document.lineCount - 1));
}

export function clampColumnNumber(column: number, document: vscode.TextDocument, line: number): number {
  const safeLine = clampLineNumber(line, document);
  const lineText = document.lineAt(safeLine).text;
  return Math.max(0, Math.min(column, lineText.length));
}

export function createSafePosition(
  document: vscode.TextDocument, 
  line: number, 
  column: number
): vscode.Position {
  const safeLine = clampLineNumber(line, document);
  const safeColumn = clampColumnNumber(column, document, safeLine);
  return new vscode.Position(safeLine, safeColumn);
}

/**
 * 光标定位工具
 */
export class CursorPositioner {
  /**
   * 将光标定位到指定文件的指定位置
   */
  async positionCursor(
    filePath: string,
    line: number,
    column: number,
    options: {
      reveal?: boolean;
      focus?: boolean;
      selection?: boolean;
    } = {}
  ): Promise<boolean> {
    try {
      // 默认选项
      const {
        reveal = true,
        focus = true,
        selection = false
      } = options;

      // 打开或激活文档
      const document = await this.getOrOpenDocument(filePath);
      if (!document) {
        return false;
      }

      // 获取或创建编辑器
      const editor = await this.showTextDocument(document, focus);
      if (!editor) {
        return false;
      }

      // 计算目标位置
      const position = this.calculateSafePosition(document, line, column);
      
      // 设置光标位置
      if (selection) {
        // 选择整行
        const lineStart = new vscode.Position(position.line, 0);
        const lineEnd = new vscode.Position(position.line, document.lineAt(position.line).text.length);
        editor.selection = new vscode.Selection(lineStart, lineEnd);
      } else {
        // 设置光标到行尾
        editor.selection = new vscode.Selection(position, position);
      }

      // 滚动到可见区域
      if (reveal) {
        editor.revealRange(
          new vscode.Range(position, position),
          vscode.TextEditorRevealType.InCenterIfOutsideViewport
        );
      }

      return true;
    } catch (error) {
      console.error('MarkdownImageAIWorkflow: 光标定位失败:', error);
      return false;
    }
  }

  /**
   * 将光标定位到行尾
   */
  async positionToLineEnd(
    filePath: string,
    line: number,
    options?: {
      reveal?: boolean;
      focus?: boolean;
    }
  ): Promise<boolean> {
    try {
      const document = await this.getOrOpenDocument(filePath);
      if (!document) {
        return false;
      }

      // 获取行的实际长度，确保行号在有效范围内
      const actualLine = Math.max(0, Math.min(line, document.lineCount - 1));
      const lineText = document.lineAt(actualLine).text;
      const endColumn = lineText.length;

      return await this.positionCursor(filePath, actualLine, endColumn, options);
    } catch (error) {
      console.error('MarkdownImageAIWorkflow: 定位到行尾失败:', error);
      return false;
    }
  }

  /**
   * 定位到替换后的图片链接末尾
   */
  async positionAfterImageReplacement(
    filePath: string,
    line: number,
    remoteUrl: string,
    altText?: string
  ): Promise<boolean> {
    try {
      const document = await this.getOrOpenDocument(filePath);
      if (!document) {
        return false;
      }

      // 计算新的图片链接长度
      const imageMarkdown = `![${altText || ''}](${remoteUrl})`;
      const lineText = document.lineAt(line).text;
      
      // 尝试找到图片链接在行中的位置
      const imageIndex = lineText.lastIndexOf('![');
      if (imageIndex >= 0) {
        // 定位到图片链接之后
        const targetColumn = imageIndex + imageMarkdown.length;
        return await this.positionCursor(filePath, line, targetColumn, {
          reveal: true,
          focus: true
        });
      } else {
        // 如果找不到，定位到行尾
        return await this.positionToLineEnd(filePath, line);
      }
    } catch (error) {
      console.error('MarkdownImageAIWorkflow: 定位到图片链接后失败:', error);
      return false;
    }
  }

  /**
   * 显示成功提示并定位光标
   */
  async showSuccessAndPosition(
    filePath: string,
    line: number,
    column: number,
    message: string
  ): Promise<void> {
    // 显示成功提示
    vscode.window.showInformationMessage(message);
    
    // 定位光标
    await this.positionCursor(filePath, line, column, {
      reveal: true,
      focus: true
    });
  }

  /**
   * 获取或打开文档
   */
  private async getOrOpenDocument(filePath: string): Promise<vscode.TextDocument | null> {
    try {
      // 检查是否已打开
      const openDoc = vscode.workspace.textDocuments.find(
        doc => doc.fileName === filePath
      );

      if (openDoc) {
        return openDoc;
      }

      // 打开文档
      const uri = vscode.Uri.file(filePath);
      return await vscode.workspace.openTextDocument(uri);
    } catch (error) {
      return null;
    }
  }

  /**
   * 显示文本文档
   */
  private async showTextDocument(
    document: vscode.TextDocument,
    focus: boolean = true
  ): Promise<vscode.TextEditor | null> {
    try {
      const options: vscode.TextDocumentShowOptions = {
        preserveFocus: !focus,
        preview: false
      };

      return await vscode.window.showTextDocument(document, options);
    } catch (error) {
      return null;
    }
  }

  /**
   * 计算安全的位置（不超出文档范围）
   */
  private calculateSafePosition(
    document: vscode.TextDocument,
    line: number,
    column: number
  ): vscode.Position {
    // 使用通用的安全计算函数
    return createSafePosition(document, line, column);
  }

  /**
   * 获取当前活动编辑器的光标位置
   */
  getCurrentCursorPosition(): {
    filePath: string;
    line: number;
    column: number;
  } | null {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      return null;
    }

    const position = editor.selection.active;
    return {
      filePath: editor.document.fileName,
      line: position.line,
      column: position.character
    };
  }

  /**
   * 检查指定文件是否为当前活动文档
   */
  isActiveDocument(filePath: string): boolean {
    const editor = vscode.window.activeTextEditor;
    return editor?.document.fileName === filePath;
  }
}