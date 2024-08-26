"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "Wcferry", {
    enumerable: true,
    get: function() {
        return Wcferry;
    }
});
const _extends = require("@swc/helpers/_/_extends");
const _interop_require_default = require("@swc/helpers/_/_interop_require_default");
const _interop_require_wildcard = require("@swc/helpers/_/_interop_require_wildcard");
const _os = /*#__PURE__*/ _interop_require_default._(require("os"));
const _nng = require("@rustup/nng");
const _child_process = /*#__PURE__*/ _interop_require_wildcard._(require("child_process"));
const _debug = /*#__PURE__*/ _interop_require_default._(require("debug"));
const _wcf = require("./proto-generated/wcf");
const _roomdata = /*#__PURE__*/ _interop_require_wildcard._(require("./proto-generated/roomdata"));
const _extrabyte = /*#__PURE__*/ _interop_require_wildcard._(require("./proto-generated/extrabyte"));
const _events = require("events");
const _utils = require("./utils");
const _fileref = require("./file-ref");
const _message = require("./message");
const _path = /*#__PURE__*/ _interop_require_default._(require("path"));
const logger = (0, _debug.default)('wcferry:client');
let Wcferry = class Wcferry {
    trapOnExit() {
        process.on('exit', ()=>this.stop());
    }
    get connected() {
        return this.socket.connected();
    }
    get msgReceiving() {
        return this.isMsgReceiving;
    }
    createUrl(channel = 'cmd') {
        const url = `tcp://${this.options.host}:${this.options.port + (channel === 'cmd' ? 0 : 1)}`;
        logger(`wcf ${channel} url: %s`, url);
        return url;
    }
    /**
     * 设置是否接受朋友圈消息
     */ set recvPyq(pyq) {
        if (this.options.recvPyq === pyq) {
            return;
        }
        this.options.recvPyq = pyq;
        if (this.connected) {
            this.disableMsgReceiving();
            this.enableMsgReceiving();
        }
    }
    get recvPyq() {
        return this.options.recvPyq;
    }
    get msgListenerCount() {
        return this.msgEventSub.listenerCount('wxmsg');
    }
    start() {
        try {
            this.execDLL('start');
            this.socket.connect(this.createUrl());
            this.trapOnExit();
            if (this.msgListenerCount > 0) {
                this.enableMsgReceiving();
            }
        } catch (err) {
            logger('cannot connect to wcf RPC server, did wcf.exe started?');
            throw err;
        }
    }
    execDLL(verb) {
        if (!this.localMode) {
            return;
        }
        const scriptPath = _path.default.resolve(__dirname, '../../scripts/wcferry.ps1');
        const process1 = _child_process.spawnSync('powershell', [
            // '-NonInteractive',
            '-ExecutionPolicy Unrestricted',
            `-File ${scriptPath} -Verb ${verb} -Port ${this.options.port}`
        ], {
            shell: true,
            stdio: 'inherit'
        });
        if (process1.error || process1.status !== 0) {
            throw new Error(`Cannot ${verb} wcferry DLL: ${process1.error || `exit ${process1.status}`}`);
        }
    }
    stop() {
        logger('Closing conneciton...');
        this.disableMsgReceiving();
        this.socket.close();
        this.execDLL('stop');
    }
    sendRequest(req) {
        const data = req.serialize();
        const buf = this.socket.send(Buffer.from(data));
        const res = _wcf.wcf.Response.deserialize(buf);
        return res;
    }
    /** 是否已经登录 */ isLogin() {
        const req = new _wcf.wcf.Request({
            func: _wcf.wcf.Functions.FUNC_IS_LOGIN
        });
        const rsp = this.sendRequest(req);
        return rsp.status == 1;
    }
    /**获取登录账号wxid */ getSelfWxid() {
        const req = new _wcf.wcf.Request({
            func: _wcf.wcf.Functions.FUNC_GET_SELF_WXID
        });
        const rsp = this.sendRequest(req);
        return rsp.str;
    }
    /** 获取登录账号个人信息 */ getUserInfo() {
        const req = new _wcf.wcf.Request({
            func: _wcf.wcf.Functions.FUNC_GET_USER_INFO
        });
        const rsp = this.sendRequest(req);
        return rsp.ui;
    }
    /** 获取完整通讯录 */ getContacts() {
        const req = new _wcf.wcf.Request({
            func: _wcf.wcf.Functions.FUNC_GET_CONTACTS
        });
        const rsp = this.sendRequest(req);
        return rsp.contacts.contacts.map((c)=>c.toObject());
    }
    /** 通过 wxid 查询微信号昵称等信息 */ getContact(wxid) {
        const req = new _wcf.wcf.Request({
            func: _wcf.wcf.Functions.FUNC_GET_CONTACT_INFO,
            str: wxid
        });
        const rsp = this.sendRequest(req);
        return rsp.contacts.contacts[0].toObject();
    }
    /** 获取所有数据库 */ getDbNames() {
        const req = new _wcf.wcf.Request({
            func: _wcf.wcf.Functions.FUNC_GET_DB_NAMES
        });
        const rsp = this.sendRequest(req);
        return rsp.dbs.names;
    }
    /** 获取数据库中所有表 */ getDbTables(db) {
        const req = new _wcf.wcf.Request({
            func: _wcf.wcf.Functions.FUNC_GET_DB_TABLES,
            str: db
        });
        const rsp = this.sendRequest(req);
        return rsp.tables.tables.map((t)=>t.toObject());
    }
    /**
     * 执行 SQL 查询，如果数据量大注意分页
     * @param db
     * @param sql
     */ dbSqlQuery(db, sql) {
        const req = new _wcf.wcf.Request({
            func: _wcf.wcf.Functions.FUNC_EXEC_DB_QUERY,
            query: new _wcf.wcf.DbQuery({
                db,
                sql
            })
        });
        const rsp = this.sendRequest(req);
        const rows = rsp.rows.rows;
        return rows.map((r)=>Object.fromEntries(r.fields.map((f)=>[
                    f.column,
                    parseDbField(f.type, f.content)
                ])));
    }
    /**
     * 获取消息类型
     * {"47": "石头剪刀布 | 表情图片", "62": "小视频", "43": "视频", "1": "文字", "10002": "撤回消息", "40": "POSSIBLEFRIEND_MSG", "10000": "红包、系统消息", "37": "好友确认", "48": "位置", "42": "名片", "49": "共享实时位置、文件、转账、链接", "3": "图片", "34": "语音", "9999": "SYSNOTICE", "52": "VOIPNOTIFY", "53": "VOIPINVITE", "51": "微信初始化", "50": "VOIPMSG"}
     */ getMsgTypes() {
        const req = new _wcf.wcf.Request({
            func: _wcf.wcf.Functions.FUNC_GET_MSG_TYPES
        });
        const rsp = this.sendRequest(req);
        return rsp.types.types;
    }
    /**
     * 刷新朋友圈
     * @param id 开始 id，0 为最新页 (string based uint64)
     * @returns 1 为成功，其他失败
     */ refreshPyq(id) {
        const req = new _wcf.wcf.Request({
            func: _wcf.wcf.Functions.FUNC_REFRESH_PYQ,
            ui64: id
        });
        const rsp = this.sendRequest(req);
        return rsp.status;
    }
    /** 获取群聊列表 */ getChatRooms() {
        const contacts = this.getContacts();
        return contacts.filter((c)=>c.wxid.endsWith('@chatroom'));
    }
    /**
     * 获取好友列表
     * @returns
     */ getFriends() {
        const contacts = this.getContacts();
        return contacts.filter((c)=>!c.wxid.endsWith('@chatroom') && !c.wxid.startsWith('gh_') && !Object.hasOwn(this.NotFriend, c.wxid));
    }
    /**
     * 获取群成员
     * @param roomid 群的 id
     * @param times 重试次数
     * @returns 群成员列表: {wxid1: 昵称1, wxid2: 昵称2, ...}
     */ async getChatRoomMembers(roomid, times = 5) {
        if (times === 0) {
            return {};
        }
        const [room] = this.dbSqlQuery('MicroMsg.db', `SELECT RoomData FROM ChatRoom WHERE ChatRoomName = '${roomid}';`);
        if (!room) {
            await (0, _utils.sleep)();
            var _this_getChatRoomMembers;
            return (_this_getChatRoomMembers = this.getChatRoomMembers(roomid, times - 1)) != null ? _this_getChatRoomMembers : {};
        }
        const r = _roomdata.com.iamteer.wcf.RoomData.deserialize(room['RoomData']);
        const userRds = this.dbSqlQuery('MicroMsg.db', 'SELECT UserName, NickName FROM Contact;');
        const userDict = Object.fromEntries(userRds.map((u)=>[
                u['UserName'],
                u['NickName']
            ]));
        return Object.fromEntries(r.members.map((member)=>[
                member.wxid,
                member.name || userDict[member.wxid]
            ]));
    }
    /**
     * 获取群成员昵称
     * @param wxid
     * @param roomid
     * @returns 群名片
     */ getAliasInChatRoom(wxid, roomid) {
        var _roomData_members_find, _this_getNickName;
        const [room] = this.dbSqlQuery('MicroMsg.db', `SELECT RoomData FROM ChatRoom WHERE ChatRoomName = '${roomid}';`);
        if (!room) {
            return undefined;
        }
        const roomData = _roomdata.com.iamteer.wcf.RoomData.deserialize(room['RoomData']);
        return ((_roomData_members_find = roomData.members.find((m)=>m.wxid === wxid)) == null ? void 0 : _roomData_members_find.name) || ((_this_getNickName = this.getNickName(wxid)) == null ? void 0 : _this_getNickName[0]);
    }
    /**
     * be careful to SQL injection
     * @param wxids wxids
     */ getNickName(...wxids) {
        const rows = this.dbSqlQuery('MicroMsg.db', `SELECT NickName FROM Contact WHERE UserName in (${wxids.map((id)=>`'${id}'`).join(',')});`);
        return rows.map((row)=>row['NickName']);
    }
    /**
     * 邀请群成员
     * @param roomid
     * @param wxids
     * @returns int32 1 为成功，其他失败
     */ inviteChatroomMembers(roomid, wxids) {
        const req = new _wcf.wcf.Request({
            func: _wcf.wcf.Functions.FUNC_INV_ROOM_MEMBERS,
            m: new _wcf.wcf.MemberMgmt({
                roomid,
                wxids: wxids.join(',').replaceAll(' ', '')
            })
        });
        const rsp = this.sendRequest(req);
        return rsp.status;
    }
    /**
     * 添加群成员
     * @param roomid
     * @param wxids
     * @returns int32 1 为成功，其他失败
     */ addChatRoomMembers(roomid, wxids) {
        const req = new _wcf.wcf.Request({
            func: _wcf.wcf.Functions.FUNC_ADD_ROOM_MEMBERS,
            m: new _wcf.wcf.MemberMgmt({
                roomid,
                wxids: wxids.join(',').replaceAll(' ', '')
            })
        });
        const rsp = this.sendRequest(req);
        return rsp.status;
    }
    /**
     * 删除群成员
     * @param roomid
     * @param wxids
     * @returns int32 1 为成功，其他失败
     */ delChatRoomMembers(roomid, wxids) {
        const req = new _wcf.wcf.Request({
            func: _wcf.wcf.Functions.FUNC_DEL_ROOM_MEMBERS,
            m: new _wcf.wcf.MemberMgmt({
                roomid,
                wxids: wxids.join(',').replaceAll(' ', '')
            })
        });
        const rsp = this.sendRequest(req);
        return rsp.status;
    }
    /**
     * 撤回消息
     * @param msgid (uint64 in string format): 消息 id
     * @returns int: 1 为成功，其他失败
     */ revokeMsg(msgid) {
        const req = new _wcf.wcf.Request({
            func: _wcf.wcf.Functions.FUNC_REVOKE_MSG,
            ui64: msgid
        });
        const rsp = this.sendRequest(req);
        return rsp.status;
    }
    /**
     * 转发消息。可以转发文本、图片、表情、甚至各种 XML；语音也行，不过效果嘛，自己验证吧。
     * @param msgid (uint64 in string format): 消息 id
     * @param receiver string 消息接收人，wxid 或者 roomid
     * @returns int: 1 为成功，其他失败
     */ forwardMsg(msgid, receiver) {
        const req = new _wcf.wcf.Request({
            func: _wcf.wcf.Functions.FUNC_FORWARD_MSG,
            fm: new _wcf.wcf.ForwardMsg({
                id: msgid,
                receiver
            })
        });
        const rsp = this.sendRequest(req);
        return rsp.status;
    }
    /**
     * 发送文本消息
     * @param msg 要发送的消息，换行使用 `\n` （单杠）；如果 @ 人的话，需要带上跟 `aters` 里数量相同的 @
     * @param receiver 消息接收人，wxid 或者 roomid
     * @param aters 要 @ 的 wxid，多个用逗号分隔；`@所有人` 只需要 `notify@all`
     * @returns 0 为成功，其他失败
     */ sendTxt(msg, receiver, aters) {
        const req = new _wcf.wcf.Request({
            func: _wcf.wcf.Functions.FUNC_SEND_TXT,
            txt: new _wcf.wcf.TextMsg({
                msg,
                receiver,
                aters
            })
        });
        const rsp = this.sendRequest(req);
        return rsp.status;
    }
    /**
     * @param image location of the resource, can be:
     * - a local path (`C:\\Users` or `/home/user`),
     * - a link starts with `http(s)://`,
     * - a buffer (base64 string can be convert to buffer by `Buffer.from(<str>, 'base64')`)
     * - an object { type: 'Buffer', data: number[] } which can convert to Buffer
     * - a FileSavableInterface instance
     * @param receiver 消息接收人，wxid 或者 roomid
     * @returns 0 为成功，其他失败
     */ async sendImage(image, receiver) {
        const fileRef = toRef(image);
        const { path, discard } = await fileRef.save(this.options.cacheDir);
        const req = new _wcf.wcf.Request({
            func: _wcf.wcf.Functions.FUNC_SEND_IMG,
            file: new _wcf.wcf.PathMsg({
                path,
                receiver
            })
        });
        const rsp = this.sendRequest(req);
        void discard();
        return rsp.status;
    }
    /**
     * @param file location of the resource, can be:
     * - a local path (`C:\\Users` or `/home/user`),
     * - a link starts with `http(s)://`,
     * - a buffer (base64 string can be convert to buffer by `Buffer.from(<str>, 'base64')`)
     * - an object { type: 'Buffer', data: number[] } which can convert to Buffer
     * - a FileSavableInterface instance
     * @param receiver 消息接收人，wxid 或者 roomid
     * @returns 0 为成功，其他失败
     */ async sendFile(file, receiver) {
        const fileRef = toRef(file);
        const { path, discard } = await fileRef.save(this.options.cacheDir);
        const req = new _wcf.wcf.Request({
            func: _wcf.wcf.Functions.FUNC_SEND_FILE,
            file: new _wcf.wcf.PathMsg({
                path,
                receiver
            })
        });
        const rsp = this.sendRequest(req);
        void discard();
        return rsp.status;
    }
    /**
     * @deprecated Not supported
     * 发送XML
     * @param xml.content xml 内容
     * @param xml.path 封面图片路径
     * @param receiver xml 类型，如：0x21 为小程序
     * @returns 0 为成功，其他失败
     */ sendXML(xml, receiver) {
        const req = new _wcf.wcf.Request({
            func: _wcf.wcf.Functions.FUNC_SEND_XML,
            xml: new _wcf.wcf.XmlMsg({
                receiver,
                content: xml.content,
                type: xml.type,
                path: xml.path
            })
        });
        const rsp = this.sendRequest(req);
        return rsp.status;
    }
    /**
     * @deprecated Not supported
     * 发送表情
     * @param path 本地表情路径，如：`C:/Projs/WeChatRobot/emo.gif`
     * @param receiver 消息接收人，wxid 或者 roomid
     * @returns 0 为成功，其他失败
     */ sendEmotion(path, receiver) {
        const req = new _wcf.wcf.Request({
            func: _wcf.wcf.Functions.FUNC_SEND_EMOTION,
            file: new _wcf.wcf.PathMsg({
                path,
                receiver
            })
        });
        const rsp = this.sendRequest(req);
        return rsp.status;
    }
    /**
     * 发送富文本消息
     *  卡片样式：
     *       |-------------------------------------|
     *       |title, 最长两行
     *       |(长标题, 标题短的话这行没有)
     *       |digest, 最多三行，会占位    |--------|
     *       |digest, 最多三行，会占位    |thumburl|
     *       |digest, 最多三行，会占位    |--------|
     *       |(account logo) name
     *       |-------------------------------------|
     * @param desc.name 左下显示的名字
     * @param desc.account 填公众号 id 可以显示对应的头像（gh_ 开头的）
     * @param desc.title 标题，最多两行
     * @param desc.digest 摘要，三行
     * @param desc.url 点击后跳转的链接
     * @param desc.thumburl 缩略图的链接
     * @param receiver 接收人, wxid 或者 roomid
     * @returns 0 为成功，其他失败
     */ sendRichText(desc, receiver) {
        const req = new _wcf.wcf.Request({
            func: _wcf.wcf.Functions.FUNC_SEND_RICH_TXT,
            rt: new _wcf.wcf.RichText(_extends._({}, desc, {
                receiver
            }))
        });
        const rsp = this.sendRequest(req);
        return rsp.status;
    }
    /**
     * 拍一拍群友
     * @param roomid 群 id
     * @param wxid 要拍的群友的 wxid
     * @returns 1 为成功，其他失败
     */ sendPat(roomid, wxid) {
        const req = new _wcf.wcf.Request({
            func: _wcf.wcf.Functions.FUNC_SEND_PAT_MSG,
            pm: new _wcf.wcf.PatMsg({
                roomid,
                wxid
            })
        });
        const rsp = this.sendRequest(req);
        return rsp.status;
    }
    /**
     * 获取语音消息并转成 MP3
     * @param msgid 语音消息 id
     * @param dir MP3 保存目录（目录不存在会出错）
     * @param times 超时时间（秒）
     * @returns 成功返回存储路径；空字符串为失败，原因见日志。
     */ async getAudioMsg(msgid, dir, times = 3) {
        const req = new _wcf.wcf.Request({
            func: _wcf.wcf.Functions.FUNC_GET_AUDIO_MSG,
            am: new _wcf.wcf.AudioMsg({
                id: msgid,
                dir
            })
        });
        const rsp = this.sendRequest(req);
        if (rsp.str) {
            return rsp.str;
        }
        if (times > 0) {
            await (0, _utils.sleep)();
            return this.getAudioMsg(msgid, dir, times - 1);
        }
        throw new Error('Timeout: get audio msg');
    }
    /**
     * 获取 OCR 结果。鸡肋，需要图片能自动下载；通过下载接口下载的图片无法识别。
     * @param extra 待识别的图片路径，消息里的 extra
     * @param times OCR 结果
     * @returns
     */ async getOCRResult(extra, times = 2) {
        const req = new _wcf.wcf.Request({
            func: _wcf.wcf.Functions.FUNC_EXEC_OCR,
            str: extra
        });
        const rsp = this.sendRequest(req);
        if (rsp.ocr.status === 0 && rsp.ocr.result) {
            return rsp.ocr.result;
        }
        if (times > 0) {
            await (0, _utils.sleep)();
            return this.getOCRResult(extra, times - 1);
        }
        throw new Error('Timeout: get ocr result');
    }
    /**
     * @deprecated 下载附件（图片、视频、文件）。这方法别直接调用，下载图片使用 `download_image`
     * @param msgid 消息中 id
     * @param thumb 消息中的 thumb
     * @param extra 消息中的 extra
     * @returns 0 为成功, 其他失败。
     */ downloadAttach(msgid, thumb = '', extra = '') {
        const req = new _wcf.wcf.Request({
            func: _wcf.wcf.Functions.FUNC_DOWNLOAD_ATTACH,
            att: new _wcf.wcf.AttachMsg({
                id: msgid,
                thumb,
                extra
            })
        });
        const rsp = this.sendRequest(req);
        return rsp.status;
    }
    getMsgAttachments(msgid) {
        var _messages_;
        const messages = this.dbSqlQuery('MSG0.db', `Select * from MSG WHERE MsgSvrID = "${msgid}"`);
        const buf = messages == null ? void 0 : (_messages_ = messages[0]) == null ? void 0 : _messages_['BytesExtra'];
        if (!Buffer.isBuffer(buf)) {
            return {};
        }
        const extraData = _extrabyte.com.iamteer.wcf.Extra.deserialize(buf);
        const { properties } = extraData.toObject();
        if (!properties) {
            return {};
        }
        const propertyMap = Object.fromEntries(properties.map((p)=>[
                p.type,
                p.value
            ]));
        const extra = propertyMap[_extrabyte.com.iamteer.wcf.Extra.PropertyKey.Extra];
        const thumb = propertyMap[_extrabyte.com.iamteer.wcf.Extra.PropertyKey.Thumb];
        return {
            extra: extra ? _path.default.resolve(this.UserDir, extra) : '',
            thumb: thumb ? _path.default.resolve(this.UserDir, thumb) : ''
        };
    }
    /**
     * @deprecated 解密图片。这方法别直接调用，下载图片使用 `download_image`。
     * @param src 加密的图片路径
     * @param dir 保存图片的目录
     * @returns
     */ decryptImage(src, dir) {
        const req = new _wcf.wcf.Request({
            func: _wcf.wcf.Functions.FUNC_DECRYPT_IMAGE,
            dec: new _wcf.wcf.DecPath({
                src,
                dst: dir
            })
        });
        const rsp = this.sendRequest(req);
        return rsp.str;
    }
    /**
     * 下载图片
     * @param msgid 消息中 id
     * @param dir 存放图片的目录（目录不存在会出错）
     * @param extra 消息中的 extra, 如果为空，自动通过msgid获取
     * @param times 超时时间（秒）
     * @returns 成功返回存储路径；空字符串为失败，原因见日志。
     */ async downloadImage(msgid, dir, extra, thumb, times = 30) {
        const msgAttachments = extra ? {
            extra,
            thumb
        } : this.getMsgAttachments(msgid);
        if (this.downloadAttach(msgid, msgAttachments.thumb, msgAttachments.extra) !== 0) {
            return Promise.reject('Failed to download attach');
        }
        for(let cnt = 0; cnt < times; cnt++){
            const path = this.decryptImage(msgAttachments.extra || '', dir);
            if (path) {
                return path;
            }
            await (0, _utils.sleep)();
        }
        return Promise.reject('Failed to decrypt image');
    }
    /**
     * 通过好友申请
     * @param v3 加密用户名 (好友申请消息里 v3 开头的字符串)
     * @param v4 Ticket (好友申请消息里 v4 开头的字符串)
     * @param scene 申请方式 (好友申请消息里的 scene); 为了兼容旧接口，默认为扫码添加 (30)
     * @returns 1 为成功，其他失败
     */ acceptNewFriend(v3, v4, scene = 30) {
        const req = new _wcf.wcf.Request({
            func: _wcf.wcf.Functions.FUNC_ACCEPT_FRIEND,
            v: new _wcf.wcf.Verification({
                v3,
                v4,
                scene
            })
        });
        const rsp = this.sendRequest(req);
        return rsp.status;
    }
    /**
     * 接收转账
     * @param wxid 转账消息里的发送人 wxid
     * @param transferid 转账消息里的 transferid
     * @param transactionid 转账消息里的 transactionid
     * @returns 1 为成功，其他失败
     */ receiveTransfer(wxid, transferid, transactionid) {
        const req = new _wcf.wcf.Request({
            func: _wcf.wcf.Functions.FUNC_RECV_TRANSFER,
            tf: new _wcf.wcf.Transfer({
                wxid,
                tfid: transferid,
                taid: transactionid
            })
        });
        const rsp = this.sendRequest(req);
        return rsp.status;
    }
    /**
     * @internal 允许接收消息,自动根据on(...)注册的listener调用
     * @param pyq
     * @returns
     */ enableMsgReceiving() {
        if (this.isMsgReceiving) {
            return true;
        }
        const req = new _wcf.wcf.Request({
            func: _wcf.wcf.Functions.FUNC_ENABLE_RECV_TXT,
            flag: this.options.recvPyq
        });
        const rsp = this.sendRequest(req);
        if (rsp.status !== 0) {
            this.isMsgReceiving = false;
            return false;
        }
        try {
            this.msgDispose = this.receiveMessage();
            this.isMsgReceiving = true;
            return true;
        } catch (err) {
            this.msgDispose == null ? void 0 : this.msgDispose.call(this);
            this.isMsgReceiving = false;
            logger('enable message receiving error: %O', err);
            return false;
        }
    }
    /**
     * @internal 停止接收消息,自动根据on(...)注册/注销的listener 调用
     * @param force
     * @returns
     */ disableMsgReceiving(force = false) {
        if (!force && !this.isMsgReceiving) {
            return 0;
        }
        const req = new _wcf.wcf.Request({
            func: _wcf.wcf.Functions.FUNC_DISABLE_RECV_TXT
        });
        const rsp = this.sendRequest(req);
        this.isMsgReceiving = false;
        this.msgDispose == null ? void 0 : this.msgDispose.call(this);
        this.msgDispose = undefined;
        return rsp.status;
    }
    receiveMessage() {
        const disposable = _nng.Socket.recvMessage(this.createUrl('msg'), null, this.messageCallback.bind(this));
        return ()=>disposable.dispose();
    }
    messageCallback(err, buf) {
        if (err) {
            logger('error while receiving message: %O', err);
            return;
        }
        const rsp = _wcf.wcf.Response.deserialize(buf);
        this.msgEventSub.emit('wxmsg', new _message.Message(rsp.wxmsg));
    }
    /**
     * 注册消息回调监听函数(listener), 通过call返回的函数注销
     * 当注册的监听函数数量大于0是自动调用enableMsgReceiving,否则自动调用disableMsgReceiving
     * 设置wcferry.recvPyq = true/false 来开启关闭接受朋友圈消息
     * @param callback 监听函数
     * @returns 注销监听函数
     */ on(callback) {
        this.msgEventSub.on('wxmsg', callback);
        if (this.connected && this.msgEventSub.listenerCount('wxmsg') === 1) {
            this.enableMsgReceiving();
        }
        return ()=>{
            if (this.connected && this.msgEventSub.listenerCount('wxmsg') === 1) {
                this.disableMsgReceiving();
            }
            this.msgEventSub.off('wxmsg', callback);
        };
    }
    constructor(options){
        this.NotFriend = {
            fmessage: '朋友推荐消息',
            medianote: '语音记事本',
            floatbottle: '漂流瓶',
            filehelper: '文件传输助手',
            newsapp: '新闻'
        };
        this.isMsgReceiving = false;
        this.msgEventSub = new _events.EventEmitter();
        // TODO: get correct wechat files directory somewhere?
        this.UserDir = _path.default.join(_os.default.homedir(), 'Documents', 'WeChat Files');
        this.localMode = !(options == null ? void 0 : options.host);
        var _options_socketOptions;
        this.options = {
            port: (options == null ? void 0 : options.port) || 10086,
            host: (options == null ? void 0 : options.host) || '127.0.0.1',
            socketOptions: (_options_socketOptions = options == null ? void 0 : options.socketOptions) != null ? _options_socketOptions : {},
            cacheDir: (options == null ? void 0 : options.cacheDir) || (0, _utils.createTmpDir)(),
            recvPyq: !!(options == null ? void 0 : options.recvPyq)
        };
        (0, _utils.ensureDirSync)(this.options.cacheDir);
        this.msgEventSub.setMaxListeners(0);
        this.socket = new _nng.Socket(this.options.socketOptions);
    }
};
function toRef(file) {
    if (typeof file === 'string' || Buffer.isBuffer(file)) {
        return new _fileref.FileRef(file);
    }
    if ('save' in file) {
        return file;
    }
    return new _fileref.FileRef(Buffer.from(file.data));
}
function parseDbField(type, content) {
    // self._SQL_TYPES = {1: int, 2: float, 3: lambda x: x.decode("utf-8"), 4: bytes, 5: lambda x: None}
    switch(type){
        case 1:
            return Number.parseInt((0, _utils.uint8Array2str)(content), 10);
        case 2:
            return Number.parseFloat((0, _utils.uint8Array2str)(content));
        case 3:
        default:
            return (0, _utils.uint8Array2str)(content);
        case 4:
            return Buffer.from(content);
        case 5:
            return undefined;
    }
}

//# sourceMappingURL=client.js.map