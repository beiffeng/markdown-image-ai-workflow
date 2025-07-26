import * as vscode from 'vscode';
import * as path from 'path';
import { createSafePosition } from './cursorPosition';

/**
 * Markdown图片链接替换器
 */
export class MarkdownReplacer {
  /**
   * 在指定的Markdown文件中替换图片链接
   */
  async replaceImageLink(
    markdownFilePath: string,
    localImagePath: string,
    remoteUrl: string
  ): Promise<{
    success: boolean;
    line?: number;
    column?: number;
    error?: string;
  }> {
    try {
      // 打开或获取文档
      const document = await this.getOrOpenDocument(markdownFilePath);
      if (!document) {
        return {
          success: false,
          error: '无法打开Markdown文件'
        };
      }

      // 查找图片引用
      const imageReference = this.findImageReference(document, localImagePath);
      if (!imageReference) {
        return {
          success: false,
          error: '在Markdown文档中未找到对应的图片引用'
        };
      }

      // 执行替换
      const editor = await vscode.window.showTextDocument(document);
      const success = await editor.edit(editBuilder => {
        editBuilder.replace(imageReference.range, imageReference.newText(remoteUrl));
      });

      if (success) {
        // 保存文档
        await document.save();
        
        return {
          success: true,
          line: imageReference.range.start.line,
          column: imageReference.range.end.character
        };
      } else {
        return {
          success: false,
          error: '替换操作失败'
        };
      }
    } catch (error) {
      console.error('MarkdownImageFlow: 替换图片链接失败:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : '未知错误'
      };
    }
  }

  /**
   * 获取或打开文档
   */
  private async getOrOpenDocument(filePath: string): Promise<vscode.TextDocument | null> {
    try {
      // 先检查是否已经打开
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
      console.error('MarkdownImageFlow: 打开文档失败:', error);
      return null;
    }
  }

  /**
   * 在文档中查找图片引用
   */
  private findImageReference(
    document: vscode.TextDocument,
    localImagePath: string
  ): ImageReference | null {
    const imageFileName = path.basename(localImagePath);
    const text = document.getText();
    
    // 计算相对路径（用于匹配）
    const documentDir = path.dirname(document.fileName);
    const relativePath = path.relative(documentDir, localImagePath);
    const normalizedRelativePath = relativePath.replace(/\\/g, '/');

    // 多种匹配模式
    const patterns = [
      // 1. 完整路径匹配
      {
        regex: new RegExp(`!\\[([^\\]]*)\\]\\(([^\\)]*${this.escapeRegExp(normalizedRelativePath)}[^\\)]*)\\)`, 'g'),
        type: 'full-path' as const
      },
      // 2. 文件名匹配
      {
        regex: new RegExp(`!\\[([^\\]]*)\\]\\(([^\\)]*${this.escapeRegExp(imageFileName)}[^\\)]*)\\)`, 'g'),
        type: 'filename' as const
      },
      // 3. 相对路径匹配（处理 ./ 和 ../ 前缀）
      {
        regex: new RegExp(`!\\[([^\\]]*)\\]\\((\\./[^\\)]*${this.escapeRegExp(imageFileName)}[^\\)]*)\\)`, 'g'),
        type: 'relative-path' as const
      }
    ];

    // 按优先级查找
    for (const pattern of patterns) {
      const match = this.findFirstMatch(document, text, pattern.regex, localImagePath);
      if (match) {
        return match;
      }
    }

    // 如果都没找到，尝试模糊匹配（最近添加的图片）
    return this.findRecentImageReference(document, text, imageFileName);
  }

  /**
   * 查找第一个匹配项
   */
  private findFirstMatch(
    document: vscode.TextDocument,
    text: string,
    regex: RegExp,
    localImagePath: string
  ): ImageReference | null {
    let match;
    const matches: Array<{ match: RegExpExecArray; score: number }> = [];

    while ((match = regex.exec(text)) !== null) {
      const imagePath = match[2];
      
      // 计算匹配分数
      const score = this.calculateMatchScore(imagePath, localImagePath);
      matches.push({ match, score });
    }

    if (matches.length === 0) {
      return null;
    }

    // 选择分数最高的匹配
    const bestMatch = matches.sort((a, b) => b.score - a.score)[0];
    const match_result = bestMatch.match;

    const startPos = document.positionAt(match_result.index!);
    const endPos = document.positionAt(match_result.index! + match_result[0].length);
    const range = new vscode.Range(startPos, endPos);

    return {
      range,
      altText: match_result[1] || '',
      originalPath: match_result[2],
      newText: (remoteUrl: string) => `![${match_result[1] || ''}](${remoteUrl})`
    };
  }

  /**
   * 查找最近的图片引用（模糊匹配）
   */
  private findRecentImageReference(
    document: vscode.TextDocument,
    text: string,
    _imageFileName: string
  ): ImageReference | null {
    // 查找所有图片引用
    const imageRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;
    let match;
    const allMatches: Array<{
      match: RegExpExecArray;
      position: number;
    }> = [];

    while ((match = imageRegex.exec(text)) !== null) {
      allMatches.push({
        match,
        position: match.index!
      });
    }

    if (allMatches.length === 0) {
      return null;
    }

    // 按位置排序，选择最后一个（最可能是刚添加的）
    const lastMatch = allMatches.sort((a, b) => b.position - a.position)[0];
    const match_result = lastMatch.match;

    const startPos = document.positionAt(match_result.index!);
    const endPos = document.positionAt(match_result.index! + match_result[0].length);
    const range = new vscode.Range(startPos, endPos);

    return {
      range,
      altText: match_result[1] || '',
      originalPath: match_result[2],
      newText: (remoteUrl: string) => `![${match_result[1] || ''}](${remoteUrl})`
    };
  }

  /**
   * 计算路径匹配分数
   */
  private calculateMatchScore(imagePath: string, localImagePath: string): number {
    let score = 0;
    
    const imageFileName = path.basename(localImagePath);
    const pathFileName = path.basename(imagePath);
    
    // 文件名完全匹配
    if (pathFileName === imageFileName) {
      score += 100;
    }
    
    // 路径包含匹配
    if (imagePath.includes(imageFileName)) {
      score += 50;
    }
    
    // 相对路径匹配
    const documentDir = path.dirname(localImagePath);
    const relativePath = path.relative(documentDir, localImagePath);
    if (imagePath.includes(relativePath.replace(/\\/g, '/'))) {
      score += 75;
    }
    
    return score;
  }

  /**
   * 转义正则表达式特殊字符
   */
  private escapeRegExp(string: string): string {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * 获取光标应该定位的位置
   */
  getCursorPosition(
    document: vscode.TextDocument,
    line: number,
    column: number
  ): vscode.Position {
    // 使用通用的安全计算函数
    return createSafePosition(document, line, column);
  }
}

/**
 * 图片引用信息
 */
interface ImageReference {
  range: vscode.Range;
  altText: string;
  originalPath: string;
  newText: (remoteUrl: string) => string;
}