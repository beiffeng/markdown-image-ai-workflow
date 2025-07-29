import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

/**
 * 图片链接信息
 */
export interface ImageLinkInfo {
  /** 完整的markdown图片语法 */
  fullMatch: string;
  /** 图片alt文本 */
  altText: string;
  /** 图片路径 */
  imagePath: string;
  /** 在文档中的起始位置 */
  startPosition: vscode.Position;
  /** 在文档中的结束位置 */
  endPosition: vscode.Position;
  /** 是否为本地路径 */
  isLocalPath: boolean;
  /** 绝对路径（仅本地图片） */
  absolutePath?: string;
  /** 文件是否存在（仅本地图片） */
  fileExists?: boolean;
}

/**
 * 图片路径解析工具类
 */
export class ImagePathParser {
  
  /**
   * 检查路径是否为本地图片路径
   */
  static isLocalImagePath(imagePath: string): boolean {
    // 排除远程URL
    if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
      return false;
    }
    
    // 排除data URL
    if (imagePath.startsWith('data:')) {
      return false;
    }
    
    // 检查是否为图片扩展名
    const imageExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.bmp', '.ico'];
    const ext = path.extname(imagePath).toLowerCase();
    
    return imageExtensions.includes(ext);
  }
  
  /**
   * 解析当前光标位置的图片链接
   */
  static parseImageAtCursor(
    document: vscode.TextDocument, 
    position: vscode.Position
  ): ImageLinkInfo | null {
    const line = document.lineAt(position.line);
    const text = line.text;
    
    // Markdown图片语法正则: ![alt](path)
    const imageRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;
    
    let match;
    while ((match = imageRegex.exec(text)) !== null) {
      const fullMatch = match[0];
      const altText = match[1];
      const imagePath = match[2];
      
      // 检查光标是否在这个图片链接范围内
      const startCol = match.index;
      const endCol = match.index + fullMatch.length;
      
      if (position.character >= startCol && position.character <= endCol) {
        const startPosition = new vscode.Position(position.line, startCol);
        const endPosition = new vscode.Position(position.line, endCol);
        
        const isLocalPath = this.isLocalImagePath(imagePath);
        let absolutePath: string | undefined;
        let fileExists: boolean | undefined;
        
        if (isLocalPath) {
          absolutePath = this.resolveAbsolutePath(document.fileName, imagePath);
          fileExists = fs.existsSync(absolutePath);
        }
        
        return {
          fullMatch,
          altText,
          imagePath,
          startPosition,
          endPosition,
          isLocalPath,
          absolutePath,
          fileExists
        };
      }
    }
    
    return null;
  }
  
  /**
   * 查找文档中所有的本地图片链接
   */
  static findAllLocalImages(document: vscode.TextDocument): ImageLinkInfo[] {
    const results: ImageLinkInfo[] = [];
    const imageRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;
    
    for (let lineIndex = 0; lineIndex < document.lineCount; lineIndex++) {
      const line = document.lineAt(lineIndex);
      const text = line.text;
      
      let match;
      while ((match = imageRegex.exec(text)) !== null) {
        const fullMatch = match[0];
        const altText = match[1];
        const imagePath = match[2];
        
        if (this.isLocalImagePath(imagePath)) {
          const startCol = match.index;
          const endCol = match.index + fullMatch.length;
          const startPosition = new vscode.Position(lineIndex, startCol);
          const endPosition = new vscode.Position(lineIndex, endCol);
          
          const absolutePath = this.resolveAbsolutePath(document.fileName, imagePath);
          const fileExists = fs.existsSync(absolutePath);
          
          results.push({
            fullMatch,
            altText,
            imagePath,
            startPosition,
            endPosition,
            isLocalPath: true,
            absolutePath,
            fileExists
          });
        }
      }
      
      // 重置正则表达式的lastIndex
      imageRegex.lastIndex = 0;
    }
    
    return results;
  }
  
  /**
   * 解析相对路径为绝对路径
   */
  static resolveAbsolutePath(markdownFilePath: string, imagePath: string): string {
    const markdownDir = path.dirname(markdownFilePath);
    return path.resolve(markdownDir, imagePath);
  }
  
  /**
   * 检查图片文件是否存在且可读
   */
  static async isImageFileValid(filePath: string): Promise<boolean> {
    try {
      const stats = await fs.promises.stat(filePath);
      return stats.isFile() && stats.size > 0;
    } catch {
      return false;
    }
  }
  
  /**
   * 获取图片的基本信息
   */
  static async getImageInfo(filePath: string): Promise<{
    exists: boolean;
    size?: number;
    extension?: string;
  }> {
    try {
      const stats = await fs.promises.stat(filePath);
      return {
        exists: true,
        size: stats.size,
        extension: path.extname(filePath).toLowerCase()
      };
    } catch {
      return { exists: false };
    }
  }
}