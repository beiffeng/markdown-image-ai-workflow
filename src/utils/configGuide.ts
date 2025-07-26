import * as vscode from 'vscode';

/**
 * 配置引导工具
 */
export class ConfigurationGuide {
  /**
   * 显示首次使用引导
   */
  async showWelcomeGuide(): Promise<void> {
    const message = `
🎉 欢迎使用 Image Bed Uploader！

这个插件基于VSCode原生的 markdown.copyFiles.destination 特性，
自动将粘贴的图片上传到图床并替换为远程链接。

要开始使用，请确保：
1. 配置了 markdown.copyFiles.destination
2. 选择并配置了图床服务
`;

    const choice = await vscode.window.showInformationMessage(
      message,
      '立即配置',
      '查看文档',
      '稍后'
    );

    switch (choice) {
      case '立即配置':
        await this.startConfigurationWizard();
        break;
      case '查看文档':
        await this.openDocumentation();
        break;
    }
  }

  /**
   * 启动配置向导
   */
  async startConfigurationWizard(): Promise<void> {
    // 步骤1：检查VSCode配置
    const vsCodeConfigured = await this.checkAndConfigureVSCode();
    if (!vsCodeConfigured) {
      return;
    }

    // 步骤2：配置图床服务
    await this.configureImageBed();

    // 步骤3：完成配置
    await this.showConfigurationComplete();
  }

  /**
   * 检查并配置VSCode
   */
  private async checkAndConfigureVSCode(): Promise<boolean> {
    const config = vscode.workspace.getConfiguration();
    const destination = config.get('markdown.copyFiles.destination');

    if (!destination) {
      const choice = await vscode.window.showInformationMessage(
        '需要先配置VSCode的图片保存位置。是否使用推荐配置？',
        '使用推荐配置',
        '手动配置',
        '取消'
      );

      if (choice === '使用推荐配置') {
        try {
          await config.update(
            'markdown.copyFiles.destination',
            { '**/*.md': 'assets/${documentBaseName}/' },
            vscode.ConfigurationTarget.Workspace
          );
          
          vscode.window.showInformationMessage(
            '✅ VSCode配置已设置：图片将保存到 assets/{文档名}/ 目录'
          );
          return true;
        } catch (error) {
          vscode.window.showErrorMessage('设置失败：' + error);
          return false;
        }
      } else if (choice === '手动配置') {
        await vscode.commands.executeCommand('workbench.action.openSettings', 'markdown.copyFiles.destination');
        return false;
      } else {
        return false;
      }
    }

    return true;
  }

  /**
   * 配置图床服务
   */
  private async configureImageBed(): Promise<void> {
    const providers = [
      {
        label: '$(cloud) SM.MS',
        description: '免费图床服务',
        detail: '无需配置，可选择添加API Token以获得更高限制',
        provider: 'smms'
      },
      {
        label: '$(github) GitHub',
        description: 'GitHub仓库图床',
        detail: '需要配置仓库名称和Personal Access Token',
        provider: 'github'
      }
    ];

    const choice = await vscode.window.showQuickPick(providers, {
      title: '选择图床服务',
      placeHolder: '选择您要使用的图床服务'
    });

    if (choice) {
      const config = vscode.workspace.getConfiguration('markdownImageFlow');
      await config.update('provider', choice.provider, vscode.ConfigurationTarget.Global);

      if (choice.provider === 'github') {
        await this.configureGitHub();
      } else if (choice.provider === 'smms') {
        await this.configureSMMS();
      }
    }
  }

  /**
   * 配置GitHub
   */
  private async configureGitHub(): Promise<void> {
    const repo = await vscode.window.showInputBox({
      title: '配置GitHub仓库',
      prompt: '请输入GitHub仓库名称（格式：username/repo）',
      placeHolder: 'username/repo'
    });

    if (!repo) return;

    const token = await vscode.window.showInputBox({
      title: '配置GitHub Token',
      prompt: '请输入GitHub Personal Access Token',
      placeHolder: 'ghp_xxxxxxxxxxxx',
      password: true
    });

    if (!token) return;

    const config = vscode.workspace.getConfiguration('markdownImageFlow.github');
    await config.update('repo', repo, vscode.ConfigurationTarget.Global);
    await config.update('token', token, vscode.ConfigurationTarget.Global);

    vscode.window.showInformationMessage('✅ GitHub配置已保存');
  }

  /**
   * 配置SM.MS
   */
  private async configureSMMS(): Promise<void> {
    const choice = await vscode.window.showInformationMessage(
      'SM.MS无需配置即可使用。是否要配置API Token以获得更高的上传限制？',
      '配置Token',
      '跳过'
    );

    if (choice === '配置Token') {
      const token = await vscode.window.showInputBox({
        title: '配置SM.MS Token',
        prompt: '请输入SM.MS API Token（可在 https://sm.ms/home/apitoken 获取）',
        placeHolder: 'API Token'
      });

      if (token) {
        const config = vscode.workspace.getConfiguration('markdownImageFlow.smms');
        await config.update('token', token, vscode.ConfigurationTarget.Global);
        vscode.window.showInformationMessage('✅ SM.MS Token已保存');
      }
    }

    vscode.window.showInformationMessage('✅ SM.MS配置完成，现在可以直接使用');
  }

  /**
   * 显示配置完成
   */
  private async showConfigurationComplete(): Promise<void> {
    const message = `
✅ 配置完成！

现在您可以：
1. 在Markdown文件中粘贴图片
2. 插件会自动上传到图床并替换链接
3. 光标会自动定位到图片链接末尾

状态栏会显示插件状态，点击可查看详细信息。
`;

    const choice = await vscode.window.showInformationMessage(
      message,
      '开始使用',
      '查看设置'
    );

    if (choice === '查看设置') {
      await vscode.commands.executeCommand('workbench.action.openSettings', 'markdownImageFlow');
    }
  }

  /**
   * 打开文档
   */
  private async openDocumentation(): Promise<void> {
    // 这里可以打开项目的README或在线文档
    vscode.env.openExternal(vscode.Uri.parse('https://github.com/your-username/vscode-image-bed-uploader'));
  }

  /**
   * 显示VSCode配置问题的帮助
   */
  async showVSCodeConfigHelp(): Promise<void> {
    const items = [
      {
        label: '$(gear) 打开VSCode设置',
        description: '手动配置 markdown.copyFiles.destination'
      },
      {
        label: '$(rocket) 使用推荐配置',
        description: '自动应用最佳实践配置'
      },
      {
        label: '$(question) 什么是 markdown.copyFiles.destination？',
        description: '了解VSCode原生图片处理功能'
      }
    ];

    const choice = await vscode.window.showQuickPick(items, {
      title: 'VSCode图片配置帮助',
      placeHolder: '选择您需要的帮助'
    });

    switch (choice?.label) {
      case '$(gear) 打开VSCode设置':
        await vscode.commands.executeCommand('workbench.action.openSettings', 'markdown.copyFiles');
        break;
      
      case '$(rocket) 使用推荐配置':
        await this.checkAndConfigureVSCode();
        break;
      
      case '$(question) 什么是 markdown.copyFiles.destination？':
        await this.showVSCodeFeatureExplanation();
        break;
    }
  }

  /**
   * 解释VSCode功能
   */
  private async showVSCodeFeatureExplanation(): Promise<void> {
    const explanation = `
📖 关于 markdown.copyFiles.destination

这是VSCode 1.79+版本的原生功能，用于控制在Markdown文件中粘贴图片时的保存位置。

配置示例：
{
  "markdown.copyFiles.destination": {
    "**/*.md": "assets/\${documentBaseName}/"
  }
}

支持的变量：
• \${documentBaseName} - 文档名称（不含扩展名）
• \${documentFileName} - 完整文档名称
• \${documentDirName} - 文档所在目录名
• \${documentWorkspaceFolder} - 工作区路径

本插件完全基于这个功能，在VSCode保存图片后自动上传到图床。
`;

    await vscode.window.showInformationMessage(explanation, '了解了');
  }
}