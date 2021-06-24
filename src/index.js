const winston = require('winston');

const { loadConfig, checkDeprecatedConfig } = require('./lib/util.js');
const config = loadConfig('config');

const {QQ,DC} = require('./lib/bot.js');

const logFormat = winston.format(info => {
    info.level = info.level.toUpperCase();
    if (info.stack) {
        info.message = `${info.message}\n${info.stack}`;
    }
    return info;
});
winston.add(new winston.transports.Console({
    format: winston.format.combine(
        logFormat(),
        winston.format.colorize(),
        winston.format.timestamp({
            format: 'YYYY-MM-DD HH:mm:ss'
        }),
        winston.format.printf(info => `${info.timestamp} [${info.level}] ${info.message}`)
    ),
}));

process.on('unhandledRejection', (reason, promise) => {
    promise.catch(e => {
        winston.error('Unhandled Rejection: ', e);
    });
});

process.on('uncaughtException', (err, origin) => {
    winston.error(`Uncaught exception:`, err);
});

process.on('rejectionHandled', promise => {
    // 忽略
});


if (config === null) {
    winston.error('No config file found. Exit.');
    process.exit(1);
}

if (config.logging && config.logging.level) {
    winston.level = config.logging.level;
} else {
    winston.level = 'info';
}

var scp = require('./lib/scpush.js');

var qq = new QQ(config.bot);
qq.start();

var dc = new DC(config.bot);
dc.start();

scp.start(config.bot.SCPush, {qq:qq._client, dc:dc._client});
