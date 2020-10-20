const oicq = require('oicq');
const fs = require('fs');
const winston = require('winston');
const asciify = require('asciify-image');
const readline = require('readline');
const Crom = require('./crom.js');
const {branch} = require('./util.js');

class QQ {
  constructor(config = {}) {
    let botConfig = config.QQ || {};
    let client = oicq.createClient(botConfig.qq, {
      platform: botConfig.platform || 2,
      log_level: botConfig.logLevel || 'off',
      kickoff: botConfig.kickoff || false,
      ignore_self: botConfig.ignoreSelf,
      device_path: botConfig.devicePath || './data/'
    });

    this._client = client;
    this._passwordMd5 = botConfig.passwordMd5;
    this._cromConfig = config.Crom;
    if (typeof this._cromConfig.serveGroup=="string") {
      this._cromConfig.serveGroup = JSON.parse(this._cromConfig.serveGroup);
    }
    this._crom = new Crom();

    client.on('system.login', (info)=>{
      switch (info.sub_type) {
        case 'captcha':
          winston.info('QQBot CAPTCHA required.');
          //fs.writeFileSync('./data/captcha.jpg', info.image)
          asciify(info.image, { fit: 'box', width: '100%', }, function (err, asciified) {
            if (err) throw err;
            let stdin = readline.createInterface({ input: process.stdin });
            console.log(asciified);
            winston.info('Please enter CAPTCHA code: ')
            stdin.on('line', (input)=>{
                client.captchaLogin(input.trim())
                stdin.close()
            })
          });
          break;
        case 'device':
          winston.info(`QQBot device lock unlocking required: ${info.url}`);
          break;
        case 'error':
          winston.error(`QQBot Error: ${info.message}`);
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
          break;
        case 'frozen':
          winston.error('QQBot offline as account was frozen.');
          break;
        case 'kickoff':
          winston.info('QQBot offline as account was logged in elsewhere.');
          break;
        case 'unknown':
          winston.error('QQBot offline due to unknown error.');
          break;
      }
    });

    client.on('system.reconn', ()=>{
      winston.info('QQBot attempting to reconnect.');
    });
  }

  async getCrom(msg) {
    let config = this._cromConfig;
    let rawText = '';
    let reply = [];
    msg.message.map(part=>{
      rawText += part.type=='text' ? part.data.text : '';
    });
    if (/\[{3}.+\]{3}/gi.test(rawText)||/\{.+\}/gi.test(rawText)) {
      let rel = [...rawText.matchAll(/\[{3}((?<site>[a-zA-Z]{2,3})\|)?(?<queri>[-\w\:]{1,60})\]{3}/gi)];
      let query = [...rawText.matchAll(/\{(\[(?<site>[a-zA-Z]{2,3})\])?(?<queri>.+)\}/gi)];
      let reply = [];
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
          ans += `\n${res[0].url}`
          reply.push(ans)
        }
      }
    } else if (/\&.+\&/gi.test(rawText)) {
      let query = [...rawText.matchAll(/\&(\[(?<site>[a-zA-Z]{2,3})\])?(?<queri>.+)\&/gi)];
      for (var i = 0; i < query.length; i++) {
        let {queri, site} = query[i].groups;
        site = site ? site.toLowerCase() : undefined;
        let filter = {
          anyBaseUrl: !!site&&!!branch[site] ? branch[site] : branch[config.scpSite],
          baseUrl: !!site&&!!branch[site] ? branch[site] : branch[config.scpSite]
        }
        if (site&&site==="all") { filter.anyBaseUrl=null; filter.baseUrl=null; };
        let res = await this._crom.searchUsers(queri, filter);
        res = res.data.searchUsers;
        if (res.length) {
          let ans = res[0].name;
          ans += `: ${!!site&&(site==="all"||!!branch[site]) ? site.toUpperCase() : config.scpSite.toUpperCase()} #${res[0].statistics.rank}`;
          ans += `\n共 ${res[0].statistics.pageCount} 頁面，總評分 ${res[0].statistics.totalRating}，平均分 ${res[0].statistics.meanRating}`;
          ans += res[0].authorInfos.length ? `\n作者頁：${res[0].authorInfos[0].authorPage.url}` : "";
          reply.push(ans);
        }
      }
    } else return false;
    return reply;
  }

  cromPrivate() {
    this._client.on("message.private", async msg => {
      try {
        let reply = await this.getCrom(msg);
        if (reply===false) return;
        if (reply.length) {
          await this._client.sendPrivateMsg(msg.sender.user_id, reply.join("\n\n"));
        } else {
          await this._client.sendPrivateMsg(msg.sender.user_id, "無結果。");
        }
      } catch (e) {
        winston.error(e.stack)
      }
    })
  }

  cromGroup() {
    this._client.on("message.group", async msg => {
      try {
        if (!this._cromConfig.serveGroup.includes(msg.group_id)) return;
        let reply = await this.getCrom(msg);
        if (reply===false) return;
        if (reply.length) {
          await this._client.sendGroupMsg(msg.group_id, reply.join("\n\n"));
        } else {
          await this._client.sendGroupMsg(msg.group_id, "無結果。");
        }
      } catch (e) {
        winston.error(e.stack)
      }
    })
  }

  crom() {
    if (![undefined, false, []].includes(this._cromConfig.serveGroup)) this.cromGroup();
    if (this._cromConfig.servePrivate) this.cromPrivate();
  }

  async start() {
    if (!this._started) {
      this._started = true;
      this.crom()
      this._client.login(this._passwordMd5);
    }
  }

  async stop() {
    if (this._started) {
      this._started = false;
      this._client.terminate();
    }
  }
};

module.exports = QQ;
