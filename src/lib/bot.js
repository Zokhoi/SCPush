const oicq = require('oicq');
const Discord = require('discord.js')
const fs = require('fs');
const winston = require('winston');
const asciify = require('asciify-image');
const readline = require('readline');
const CromApi = require('./crom.js');
const {branch, SlowModeCache:SMC} = require('./util.js');
const LRU = require('lru-cache');

class QQ {
  constructor(config = {}) {
    this._disabled = config.QQ.disabled;
    let botConfig = config.QQ || {};
    let client;
    if (!this._disabled) {
      client = oicq.createClient(botConfig.qq, {
        platform: botConfig.platform || 3,
        log_level: botConfig.logLevel || 'off',
        kickoff: botConfig.kickoff || false,
        ignore_self: true,
        device_path: botConfig.devicePath || './data/'
      });
    }
    

    this.qqid = botConfig.qq;
    this.platform = botConfig.platform || 3;
    this.logLevel = botConfig.logLevel || 'off';
    this.kickoff = botConfig.kickoff || false;
    this.ignoreSelf = true;
    this.devicePath = botConfig.devicePath || './data/';

    this._client = client;
    this._passwordMd5 = botConfig.passwordMd5;
    
    this._crom = new Crom(config, this);

    client.on('system.login', (info)=>{
      switch (info.sub_type) {
        case 'captcha':
            winston.info('QQBot CAPTCHA required.');
            //fs.writeFileSync('./data/captcha.jpg', info.image)
            asciify(info.image, { fit: 'box', width: '100%', }, function (err, asciified) {
                if (err) throw err;
                let cstdin = readline.createInterface({ input: process.stdin });
                console.log(asciified);
                winston.info('Please enter CAPTCHA code: ')
                cstdin.on('line', (input)=>{
                    client.captchaLogin(input.trim());
                    cstdin.close();
                })
            });
            break;
        case 'slider':
            winston.info(`QQBot slider required: ${info.url}`);
            let sstdin = readline.createInterface({ input: process.stdin });
            winston.info('Please enter slider ticket: ');
            sstdin.on('line', (input)=>{
                client.sliderLogin(input.trim());
                sstdin.close();
            })
            break;
        case 'device':
          winston.info(`QQBot device lock unlocking required: ${info.url}`);
          break;
        case 'error':
          winston.error(`QQBot Error ${info.code}: ${info.message}`);
          break;
      }
    });

    client.on('system.online', ()=>{
      winston.info('QQBot is ready.');
    });

    client.on('system.offline', (info)=>{
      switch (info.sub_type) {
        case 'network':
          winston.info('QQBot offline as network has disconnected.');
          return;
        case 'frozen':
          winston.error('QQBot offline as account was frozen.');
          return;
        case 'kickoff':
          winston.info('QQBot offline as account was logged in elsewhere.');
          if (this._kickoff) { break; }
          else return;
        case 'device':
          winston.error('QQBot offline as device lock needs authentication.');
          return;
        case 'unknown':
          winston.error('QQBot offline due to unknown error.');
          return;
      }
    });

    client.on('system.reconn', ()=>{
      winston.info('QQBot attempting to reconnect.');
    });
  }

  async start() {
    if (!this._started && !this._disabled) {
      this._started = true;
      this._crom.start();
      this._client.login(this._passwordMd5);
    }
  }

  async stop() {
    if (this._started && !this._disabled) {
      this._started = false;
      this._client.terminate();
    }
  }
  
  on(...props) {
    return this._client.on(...props);
  }
};

class DC {
  constructor(config = {}) {
    this._disabled = config.Discord.disabled;
    this._token = config.Discord.token;
    
    if (!this._disabled) this._client = new Discord.Client();
  }

  async start() {
    if (!this._started && !this._disabled) {
      this._started = true;
      this._client.login(this._token);
    }
  }

  async stop() {
    if (this._started && !this._disabled) {
      this._started = false;
      this._client.destroy();
    }
  }
}

class Crom {
  constructor(config, qq) {
    this.qq = qq;
    this._crom = new CromApi();
    this._cromConfig = config.Crom;
    if (typeof this._cromConfig.serveQGroup=="string") {
      this._cromConfig.serveQGroup = JSON.parse(this._cromConfig.serveQGroup);
    }

    this._antiSpam = new LRU({
      max: 500,
      maxAge: 5000,
    });
    this._slowMo = new SMC({
      max: 500,
      maxAge: 60000,
    });
  }
  
  async getCrom(msg) {
    let config = this._cromConfig;
    let reply = [];
    if (/\[{3}.+\]{3}/gi.test(msg)||/\{.+\}/gi.test(msg)) {
      let rel = [...msg.matchAll(/\[{3}((?<site>[a-zA-Z]{2,3})\|)?(?<queri>[-\w\:]{1,60})\]{3}/gi)];
      let query = [...msg.matchAll(/\{(\[(?<site>[a-zA-Z]{2,3})\])?(?<queri>.+)\}/gi)];
      for (var i = 0; i < rel.length; i++) {
        let {queri, site} = rel[i].groups;
        site = site ? site.toLowerCase() : undefined;
        reply.push(`${!!site&&!!branch[site] ? branch[site] : branch[config.scpSite]}/${queri}`);
      }
      for (var i = 0; i < query.length; i++) {
        let {queri, site} = query[i].groups;
        site = site ? site.toLowerCase() : undefined;
        let res = await this._crom.searchPages(queri, {
          anyBaseUrl: !!site&&!!branch[site] ? branch[site] : branch[config.scpSite]
        });
        res = res.data.searchPages;
        if (res.length) {
          let ans = res[0].wikidotInfo ? res[0].wikidotInfo.title : '' ;
          ans += ans && res[0].alternateTitles.length ? ' - ' : '';
          ans += res[0].alternateTitles.length ? res[0].alternateTitles[0].title : '';
          ans += !ans && res[0].translationOf && res[0].translationOf.wikidotInfo ? res[0].translationOf.wikidotInfo.title : '';
          ans += res[0].wikidotInfo ? `\n評分：${res[0].wikidotInfo.rating}` : '' ;
          reply.push(ans);
          reply.push(`網址：${res[0].url}`);
        }
      }
    } else if (/\&.+\&/gi.test(msg)) {
      let query = [...msg.matchAll(/\&(\[(?<site>[a-zA-Z]{2,3})\])?(?<queri>.+)\&/gi)];
      for (var i = 0; i < query.length; i++) {
        let {queri, site} = query[i].groups;
        site = site ? site.toLowerCase() : undefined;
        let filter = {
          anyBaseUrl: !!site&&!!branch[site] ? branch[site] : branch[config.scpSite],
          baseUrl: !!site&&!!branch[site] ? branch[site] : branch[config.scpSite]
        }
        if (site&&site==="all") { filter.anyBaseUrl=null; filter.baseUrl=null; };
        let res = /^\#\d+$/.test(queri) ?
          (await this._crom.searchUserByRank(parseInt(queri.slice(1)),filter)) :
          (await this._crom.searchUsers(queri, filter));
        res = res.data[/^\#\d+$/.test(queri) ? 'usersByRank' : 'searchUsers'];
        if (res.length) {
          let ans = res[0].name;
          ans += `: ${!!site&&(site==="all"||!!branch[site]) ? site.toUpperCase() : config.scpSite.toUpperCase()} #${res[0].statistics.rank}`;
          ans += `\n共 ${res[0].statistics.pageCount} 頁面，總評分 ${res[0].statistics.totalRating}，平均分 ${res[0].statistics.meanRating}`;
          reply.push(ans);
          if (res[0].authorInfos.length) reply.push(`作者頁：${res[0].authorInfos[0].authorPage.url}`)
        }
      }
    } else return false;
    return reply;
  }

  cromQPrivate() {
    this.qq._client.on("message.private", async msg => {
      try {
        let rawText = '';
        msg.message.map(part=>{ rawText += part.type=='text' ? part.data.text : ''; });
        if (this._antiSpam.peek(`${msg.sender.user_id}: ${rawText}`)) return;
        let reply = await this.getCrom(rawText);
        if (reply===false) return;
        if (reply.length) {
          // 過濾ignoreSelf為false下文章標題或其他東西誤觸發無限循環
          if (!this.qq.ignoreSelf && msg.sender.user_id == this.qq.qqid) {
            let id = `${msg.sender.user_id}: ${reply.join("\n\n")}`;
            if (this._antiSpam.peek(id)) {
              this._antiSpam.set(id, 1);
              for (let i = 0; i < reply.length; i++) {
                await this.qq._client.sendPrivateMsg(msg.sender.user_id, reply[i]);
              }
            }
          } else {
            for (let i = 0; i < reply.length; i++) {
              await this.qq._client.sendPrivateMsg(msg.sender.user_id, reply[i]);
            }
            // await this.qq._client.sendPrivateMsg(msg.sender.user_id, reply.join("\n\n"));
          }
        } else {
          await this.qq._client.sendPrivateMsg(msg.sender.user_id, "無結果。");
        }
      } catch (e) {
        winston.error(e.stack)
      }
    })
  }

  cromQGroup() {
    let sendReply = async (msg, reply) => {
      if (reply.length) {
        if (!this.qq.ignoreSelf && msg.sender.user_id == this.qqid) {
          // 過濾ignoreSelf為false下文章標題或其他東西誤觸發無限循環
          let id = `${msg.group_id}: ${reply.join("\n\n")}`;
          if (!this._antiSpam.peek(id)) {
            this._antiSpam.set(id, 1);
            await this.qq._client.sendGroupMsg(msg.group_id, reply.join("\n\n"));
          }
        } else {
          await this.qq._client.sendGroupMsg(msg.group_id, reply.join("\n\n"));
        }
      } else {
        await this.qq._client.sendGroupMsg(msg.group_id, "無結果。");
      }
    }

    this.qq._client.on("message.group", async msg => {
      try {
        if (!this._cromConfig.serveQGroup.includes(msg.group_id)) return;
        console.log(msg)
        let rawText = '';
        msg.message.map(part=>{ rawText += part.type=='text' ? part.data.text : ''; });
        if (this._antiSpam.peek(`${msg.group_id}: ${rawText}`)) return;
        let reply = await this.getCrom(rawText);
        if (reply===false) return;

        if (this._cromConfig.slowMode && this._cromConfig.slowMode.count) {
          // 處理慢速模式
          let id = `${msg.group_id}`;
          let count = this._slowMo.get(id) || 0;
          if (++count <= this._cromConfig.slowMode.count) {
            this._slowMo.set(id, count);
            await sendReply(msg, reply);
          } else {
            await this.qq._client.sendGroupMsg(msg.group_id, `已開啟慢速模式，一分鐘只能請求 ${this._cromConfig.slowMode.count} 次。`);
          }
        } else {
          await sendReply(msg, reply);
        }
      } catch (e) {
        winston.error(e.stack)
      }
    })
  }

  start() {
    if (![undefined, false, []].includes(this._cromConfig.serveQGroup)) this.cromQGroup();
    if (this._cromConfig.serveQPrivate) this.cromQPrivate();
  }
}

module.exports = {
  QQ,
  DC,
  Crom,
};
