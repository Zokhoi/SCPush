module.exports.run = (cq, msg, args) => {
  clearInterval(cq.__scp.id.rec);
  cq.__scp.sendRec();
  cq.__scp.id.rec = setInterval(cq.__scp.sendRec, 3600000);
}

module.exports.help = {
  name:"reset"
}
