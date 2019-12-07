/* eslint-disable max-len */
/* eslint-disable consistent-return */
const Discord = require('discord.js');

const cooldowns = new Discord.Collection();

module.exports = async (client, message) => {
  // Ignore all bots
  if (message.author.bot) {
    return;
  }

  // Emoji finding and tracking
  const regex = /<a?:\w+:([\d]+)>/g;
  const msg = message.content;
  let regMatch;
  while ((regMatch = regex.exec(msg)) !== null) {
    // If the emoji ID is in our emojiDB, then increment its count
    if (client.emojiDB.has(regMatch[1])) {
      client.emojiDb.inc(regMatch[1]);
    }
  }

  if (message.guild && !message.member) {
    await message.guild.fetchMember(message.author);
  }

  const settings = client.getSettings(message.guild);

  // Ignore messages not starting with the prefix
  if (message.content.indexOf(settings.prefix) !== 0) {
    return;
  }

  const level = client.permLevel(message);

  // Our standard argument/command name definition.
  const args = message.content.slice(settings.prefix.length).trim().split(/ +/g);
  const command = args.shift().toLowerCase();

  // Grab the command data and aliases from the client.commands Enmap
  const cmd = client.commands.get(command) || client.commands.get(client.aliases.get(command));
  const enabledCmds = client.enabledCmds.get(command) || client.enabledCmds.get(client.aliases.get(command));

  // If that command doesn't exist, silently exit and do nothing
  if (!cmd) {
    return;
  }

  if (enabledCmds.enabled === false) {
    if (level[1] < 2) {
      return client.error(message.channel, 'Command Disabled!', 'This command is currently disabled!');
    }
  }

  if (!message.guild && cmd.conf.guildOnly) {
    return client.error(message.channel, 'Command Not Available in DMs!', 'This command is unavailable in DMs. Please use it in a server!');
  }

  // eslint-disable-next-line prefer-destructuring
  message.author.permLevel = level[1];

  if (level[1] < client.levelCache[cmd.conf.permLevel]) {
    client.error(message.channel, 'Invalid Permissions!', `You do not currently have the proper permssions to run this command!\n**Current Level:** \`${level[0]}: Level ${level[1]}\`\n**Level Required:** \`${cmd.conf.permLevel}: Level ${client.levelCache[cmd.conf.permLevel]}\``);
    return console.log(`${message.author.tag} (${message.author.id}) tried to use cmd '${cmd.help.name}' without proper perms!`);
  }

  if (cmd.conf.args && (cmd.conf.args > args.length)) {
    return client.error(message.channel, 'Invalid Arguments!', `The proper usage for this command is \`${settings.prefix}${cmd.help.usage}\`! For more information, please see the help command by using \`${settings.prefix}help ${cmd.help.name}\`!`);
  }

  if (!cooldowns.has(cmd.help.name)) {
    cooldowns.set(cmd.help.name, new Discord.Collection());
  }

  const now = Date.now();
  const timestamps = cooldowns.get(cmd.help.name);
  const cooldownAmount = (cmd.conf.cooldown || 0) * 1000;

  if (timestamps.has(message.author.id)) {
    const expirationTime = timestamps.get(message.author.id) + cooldownAmount;

    if (now < expirationTime) {
      let timeLeft = (expirationTime - now) / 1000;
      let time = 'second(s)';
      if (cmd.conf.cooldown > 60) {
        timeLeft = (expirationTime - now) / 60000;
        time = 'minute(s)';
      }
      return client.error(message.channel, 'Woah There Bucko!', `Please wait **${timeLeft.toFixed(2)} more ${time}** before reusing the \`${cmd.help.name}\` command!`);
    }
  }

  timestamps.set(message.author.id, now);
  setTimeout(() => timestamps.delete(message.author.id), cooldownAmount);

  // Run the command
  const guildUsed = message.guild ? `#${message.channel.name}` : 'DMs';

  console.log(`${message.author.tag} (${message.author.id}) ran cmd '${cmd.help.name}' in ${guildUsed}!`);
  cmd.run(client, message, args, level[1], Discord);
};
