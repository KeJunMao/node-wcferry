"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "Message", {
    enumerable: true,
    get: function() {
        return Message;
    }
});
let Message = class Message {
    get raw() {
        return this.message.toObject();
    }
    get id() {
        return this.message.id;
    }
    get type() {
        return this.message.type;
    }
    get isSelf() {
        return this.message.is_self;
    }
    isAt(wxid) {
        if (!this.isGroup) {
            return false;
        }
        if (!new RegExp(`<atuserlist\\>.*(${wxid}).*</atuserlist>`).test(this.xml)) {
            return false;
        }
        if (/@(?:所有人|all|All)/.test(this.message.content)) {
            return false;
        }
        return true;
    }
    get xml() {
        return this.message.xml;
    }
    get isGroup() {
        return this.message.is_group;
    }
    get roomId() {
        return this.message.roomid;
    }
    get content() {
        return this.message.content;
    }
    get sender() {
        return this.message.sender;
    }
    constructor(message){
        this.message = message;
    }
};

//# sourceMappingURL=message.js.map