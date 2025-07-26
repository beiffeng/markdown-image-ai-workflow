"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UploaderFactory = void 0;
/**
 * 上传器工厂
 */
class UploaderFactory {
    constructor() {
        this.uploaders = new Map();
        // 注册内置上传器
        this.register('smms', () => new (require('./smms.uploader').SMSUploader)());
        this.register('github', () => new (require('./github.uploader').GitHubUploader)());
    }
    /**
     * 注册上传器
     */
    register(name, factory) {
        this.uploaders.set(name, factory);
    }
    /**
     * 创建上传器实例
     */
    create(name) {
        const factory = this.uploaders.get(name);
        if (!factory) {
            return null;
        }
        try {
            return factory();
        }
        catch (error) {
            console.error(`ImageBedUploader: 创建上传器 ${name} 失败:`, error);
            return null;
        }
    }
    /**
     * 获取所有支持的上传器名称
     */
    getSupportedUploaders() {
        return Array.from(this.uploaders.keys());
    }
}
exports.UploaderFactory = UploaderFactory;
//# sourceMappingURL=uploader.interface.js.map