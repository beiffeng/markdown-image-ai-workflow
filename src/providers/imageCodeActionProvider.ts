import * as vscode from 'vscode';
import { ImagePathParser } from '../utils/imagePathParser';
import { t } from '../i18n';

/**
 * 图片上传 Code Action Provider
 * 当光标位置在本地图片链接上时，提供"上传到图床"的快速修复选项
 */
export class ImageCodeActionProvider implements vscode.CodeActionProvider {
  
  public static readonly providedCodeActionKinds = [
    vscode.CodeActionKind.QuickFix
  ];

  /**
   * 提供 Code Actions
   */
  provideCodeActions(
    document: vscode.TextDocument,
    range: vscode.Range | vscode.Selection,
    _context: vscode.CodeActionContext,
    _token: vscode.CancellationToken
  ): vscode.ProviderResult<(vscode.CodeAction | vscode.Command)[]> {
    
    console.log('MarkdownImageAIWorkflow CodeAction: 检查文档', {
      languageId: document.languageId,
      fileName: document.fileName
    });
    
    // 只在markdown文件中生效
    if (document.languageId !== 'markdown') {
      console.log('MarkdownImageAIWorkflow CodeAction: 非markdown文件，跳过');
      return [];
    }

    // 获取光标位置（如果是选择，取开始位置）
    const position = range instanceof vscode.Selection ? range.active : range.start;
    
    console.log('MarkdownImageAIWorkflow CodeAction: 检查位置', {
      line: position.line,
      character: position.character
    });
    
    // 解析当前位置的图片链接
    const imageInfo = ImagePathParser.parseImageAtCursor(document, position);
    
    console.log('MarkdownImageAIWorkflow CodeAction: 图片信息', imageInfo);
    
    // 只为本地图片提供上传选项
    if (!imageInfo || !imageInfo.isLocalPath) {
      console.log('MarkdownImageAIWorkflow CodeAction: 无本地图片，跳过');
      return [];
    }

    const actions: vscode.CodeAction[] = [];

    // 检查文件是否存在
    if (imageInfo.fileExists) {
      // 创建上传到图床的 Code Action
      const uploadAction = new vscode.CodeAction(
        t('codeAction.uploadToImageHost'),
        vscode.CodeActionKind.QuickFix
      );
      
      uploadAction.command = {
        command: 'markdownImageAIWorkflow.uploadCurrentImage',
        title: t('codeAction.uploadToImageHost')
      };
      
      uploadAction.isPreferred = true; // 设为首选选项
      actions.push(uploadAction);
      
      console.log('MarkdownImageAIWorkflow CodeAction: 添加上传操作');
      
    } else {
      // 文件不存在时的提示
      const fixAction = new vscode.CodeAction(
        t('codeAction.imageFileNotFound'),
        vscode.CodeActionKind.QuickFix
      );
      
      fixAction.disabled = {
        reason: t('upload.fileNotExist') + ': ' + imageInfo.imagePath
      };
      
      actions.push(fixAction);
      
      console.log('MarkdownImageAIWorkflow CodeAction: 添加文件不存在提示');
    }

    console.log('MarkdownImageAIWorkflow CodeAction: 返回操作数量', actions.length);
    return actions;
  }

  /**
   * 解析 Code Action
   * 这里可以进行一些异步操作来完善 Code Action
   */
  resolveCodeAction?(
    codeAction: vscode.CodeAction,
    _token: vscode.CancellationToken
  ): vscode.ProviderResult<vscode.CodeAction> {
    return codeAction;
  }
}

/**
 * 图片诊断 Provider
 * 为不存在的本地图片文件提供诊断信息
 */
export class ImageDiagnosticsProvider {
  private diagnosticsCollection: vscode.DiagnosticCollection;

  constructor() {
    this.diagnosticsCollection = vscode.languages.createDiagnosticCollection('markdownImageAIWorkflow');
  }

  /**
   * 更新文档的诊断信息
   */
  updateDiagnostics(document: vscode.TextDocument): void {
    if (document.languageId !== 'markdown') {
      return;
    }

    const diagnostics: vscode.Diagnostic[] = [];
    const localImages = ImagePathParser.findAllLocalImages(document);

    for (const imageInfo of localImages) {
      if (!imageInfo.fileExists) {
        const diagnostic = new vscode.Diagnostic(
          new vscode.Range(imageInfo.startPosition, imageInfo.endPosition),
          `图片文件不存在: ${imageInfo.imagePath}`,
          vscode.DiagnosticSeverity.Warning
        );
        
        diagnostic.source = 'Markdown Image AI Workflow';
        diagnostic.code = 'missing-image-file';
        
        diagnostics.push(diagnostic);
      }
    }

    this.diagnosticsCollection.set(document.uri, diagnostics);
  }

  /**
   * 清除诊断信息
   */
  clear(): void {
    this.diagnosticsCollection.clear();
  }

  /**
   * 释放资源
   */
  dispose(): void {
    this.diagnosticsCollection.dispose();
  }
}