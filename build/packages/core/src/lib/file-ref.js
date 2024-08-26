"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "FileRef", {
    enumerable: true,
    get: function() {
        return FileRef;
    }
});
const _interop_require_default = require("@swc/helpers/_/_interop_require_default");
const _interop_require_wildcard = require("@swc/helpers/_/_interop_require_wildcard");
const _os = /*#__PURE__*/ _interop_require_default._(require("os"));
const _crypto = require("crypto");
const _promises = require("fs/promises");
const _mime = /*#__PURE__*/ _interop_require_default._(require("mime"));
const _path = /*#__PURE__*/ _interop_require_default._(require("path"));
const _url = require("url");
const _utils = require("./utils");
const _fs = require("fs");
const _assert = /*#__PURE__*/ _interop_require_default._(require("assert"));
const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.4896.127 Safari/537.36'
};
let FileRef = class FileRef {
    isUrl(loc) {
        return /^https?:\/\//.test(loc);
    }
    /**
     * save the file into dir with name and extension inferred
     * @param dir the saving directory, defaults to `os.tmpdir()`
     * @param cpLocal when the source is local file, if we copy it to dir or directly return the source path
     * @returns
     */ async save(dir = _os.default.tmpdir(), cpLocal = false) {
        (0, _utils.ensureDirSync)(dir);
        if (Buffer.isBuffer(this.location)) {
            return this.wrapWithDiscard(await this.saveFromBase64(dir, this.location));
        }
        if (this.isUrl(this.location)) {
            const p = await this.saveFromUrl(dir, new _url.URL(this.location));
            return this.wrapWithDiscard(p);
        }
        if (cpLocal) {
            return this.wrapWithDiscard(await this.saveFromFile(dir));
        }
        // if file existed in local, we direct use it
        return {
            path: this.location,
            discard: ()=>Promise.resolve()
        };
    }
    wrapWithDiscard(p) {
        return {
            path: p,
            discard: ()=>(0, _promises.rm)(p, {
                    force: true
                })
        };
    }
    getName(opt) {
        var _this_options_name, _ref;
        const basename = (_ref = (_this_options_name = this.options.name) != null ? _this_options_name : opt == null ? void 0 : opt.inferredName) != null ? _ref : (0, _crypto.randomUUID)();
        let ext = _path.default.extname(basename);
        if (ext) {
            return basename;
        }
        ext = 'dat';
        if (opt == null ? void 0 : opt.mimeType) {
            var _mime_getExtension;
            ext = (_mime_getExtension = _mime.default.getExtension(opt.mimeType)) != null ? _mime_getExtension : ext;
        }
        return `${basename}.${ext}`;
    }
    getSavingPath(dir, name) {
        const extname = _path.default.extname(name);
        const basename = _path.default.basename(name, extname);
        for(let i = 0;; i++){
            const suffix = i === 0 ? '' : `-${i}`;
            const p = _path.default.join(dir, `${basename}${suffix}${extname}`);
            if (!(0, _fs.existsSync)(p)) {
                return p;
            }
        }
    }
    async saveFromBase64(dir, buffer) {
        const binary = buffer.toString('binary');
        const name = this.getName();
        const fullpath = this.getSavingPath(dir, name);
        await (0, _promises.writeFile)(fullpath, binary, 'binary');
        return fullpath;
    }
    async saveFromUrl(dir, url) {
        const basename = _path.default.basename(url.pathname);
        let fullpath;
        const http = url.protocol === 'https:' ? await Promise.resolve().then(()=>/*#__PURE__*/ _interop_require_wildcard._(require("https"))) : await Promise.resolve().then(()=>/*#__PURE__*/ _interop_require_wildcard._(require("http")));
        return await new Promise((resolve, reject)=>{
            http.get(url, {
                headers
            }, (response)=>{
                var _response_headers_contentdisposition_match, _response_headers_contentdisposition;
                var _response_headers_contentdisposition_match_;
                const probeName = (_response_headers_contentdisposition_match_ = (_response_headers_contentdisposition = response.headers['content-disposition']) == null ? void 0 : (_response_headers_contentdisposition_match = _response_headers_contentdisposition.match(/attachment; filename="?(.+[^"])"?$/i)) == null ? void 0 : _response_headers_contentdisposition_match[1]) != null ? _response_headers_contentdisposition_match_ : basename;
                const mimeType = response.headers['content-type'];
                const name = this.getName({
                    mimeType,
                    inferredName: probeName
                });
                fullpath = this.getSavingPath(dir, name);
                const file = (0, _fs.createWriteStream)(fullpath);
                response.pipe(file);
                file.on('finish', ()=>{
                    file.close();
                    resolve(fullpath);
                });
            }).on('error', (error)=>{
                if (fullpath) {
                    (0, _promises.rm)(fullpath, {
                        force: true
                    }).finally(()=>{
                        reject(error.message);
                    });
                } else {
                    reject(error.message);
                }
            });
        });
    }
    async saveFromFile(dir) {
        (0, _assert.default)(typeof this.location === 'string', 'impossible');
        if (!(0, _fs.existsSync)(this.location)) {
            return Promise.reject(new Error(`Source file ${this.location} doesn't exist`));
        }
        const name = this.getName({
            inferredName: _path.default.basename(this.location)
        });
        const saved = this.getSavingPath(dir, name);
        await (0, _promises.cp)(this.location, saved, {
            force: true
        });
        return saved;
    }
    /**
     * @param location location of the resource. can be
     * - a local path
     * - a link starts with `http(s)://`
     * - a buffer
     *
     * Note: base64 string can be convert to buffer by: `Buffer.from('content', 'base64')`
     * Note: if input is a Buffer, it would be nice to have a name with correct extension in the options,
     * or a common name `<uuid>.dat` will be used
     */ constructor(location, options = {}){
        this.location = location;
        this.options = options;
    }
};

//# sourceMappingURL=file-ref.js.map