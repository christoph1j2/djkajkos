const { executionAsyncResource } = require('async_hooks');
const Discord = require('discord.js');
const ytdl = require('ytdl-core');
const { token, key } = require('./config.json')
 
const { YTSearcher } = require('ytsearcher');
const { resourceLimits } = require('worker_threads');
const { lookup } = require('dns');
 
const searcher = new YTSearcher({
    key: key,
    revealed: true
});
 
const client = new Discord.Client({ intents: 641 });
 
const queue = new Map();
 
client.on("ready", () => {
    console.log("I am online!")
})

client.login(token);
 
client.on("message", async(message) => {
    const prefix = '!';
 
    const serverQueue = queue.get(message.guild.id);
 
    const args = message.content.slice(prefix.length).trim().split(/ +/g)
    const command = args.shift().toLowerCase();
 
    switch(command){
        case 'play':
            execute(message, serverQueue);
            break;
        case 'stop':
            stop(message, serverQueue);
            break;
        case 'skip':
            skip(message, serverQueue);
            break;
        case 'pause':
            pause(serverQueue);
            break;
        case 'resume':
            resume(serverQueue);
            break;
        case 'loop':
            Loop(args, serverQueue);
            break;
        case 'queue':
            Queue(serverQueue);
            break;
    }
 
    async function execute(message, serverQueue){
        let vc = message.member.voice.channel;
        if(!vc){
            return message.channel.send("More nejdryf se prypoj a pak ti neco pustim");
        }else{
            let result = await searcher.search(args.join(" "), { type: "video" })
            const songInfo = await ytdl.getInfo(result.first.url)
 
            let song = {
                title: songInfo.videoDetails.title,
                url: songInfo.videoDetails.video_url
            };
 
            if(!serverQueue){
                const queueConstructor = {
                    txtChannel: message.channel,
                    vChannel: vc,
                    connection: null,
                    songs: [],
                    volume: 10,
                    playing: true,
                    loopone: false,
                    loopall: false
                };
                queue.set(message.guild.id, queueConstructor);
 
                queueConstructor.songs.push(song);
 
                try{
                    let connection = await vc.join();
                    queueConstructor.connection = connection;
                    play(message.guild, queueConstructor.songs[0]);
                }catch (err){
                    console.error(err);
                    queue.delete(message.guild.id);
                    return message.channel.send(`More nemuzu se prypojyt co to je za rasyzmuz toto ${err}`)
                }
            }else{
                serverQueue.songs.push(song);
                return message.channel.send(`Tetka sem tohle prydal to fronti ${song.url}`);
            }
        }
    }
    function play(guild, song){
        const serverQueue = queue.get(guild.id);
        if(!song){
            serverQueue.vChannel.leave();
            queue.delete(guild.id);
            return;
        }
        const dispatcher = serverQueue.connection
            .play(ytdl(song.url))
            .on('finish', () =>{
                if(serverQueue.loopone){
                  play(guild, serverQueue.songs[0]);
                }
                else if(serverQueue.loopall){
                  serverQueue.songs.push(serverQueue.songs[0])
                  serverQueue.songs.shift()
                }else{
                serverQueue.songs.shift();
              }
                play(guild, serverQueue.songs[0]);
            })
            serverQueue.txtChannel.send(`Tetka hraje ${serverQueue.songs[0].url}`)
    }
    function stop (message, serverQueue){
        if(!message.member.voice.channel)
            return message.channel.send("More prypoj se do toho hlasoviho kanalu ti guto jedna!")
        serverQueue.song = [];
        serverQueue.connection.dispatcher.end();
    }
    function skip (message, serverQueue){
        if(!message.member.voice.channel)
            return message.channel.send("More prypoj se do toho hlasoviho kanalu ti guto jedna!");
        if(!serverQueue)
            return message.channel.send("A co ti mam jako skypnou kdiš tu nic neni?!");
        serverQueue.connection.dispatcher.end();
    }
    function pause(serverQueue){
      if(!serverQueue.connection)
        return message.channel.send("A co ti mam jako pauznout kdiš tu nic neni?!");
      if(!message.member.voice.channel)
        return message.channel.send("More prypoj se do toho hlasoviho kanalu ti guto jedna!")
      if(serverQueue.connection.dispatcher.paused)
        return message.channel.send("Šak uš to máš pauzlí no bi tě rakovyna vzala!");
      serverQueue.connection.dispatcher.pause();
      message.channel.send("Pravje tet sem to pauznul!");
    }
    function resume(serverQueue){
      if(!serverQueue.connection)
        return message.channel.send("A co ti mam jako obnovyt kdiš tu nic neni?!");
      if(!message.member.voice.channel)
        return message.channel.send("More prypoj se do toho hlasoviho kanalu ti guto jedna!")
      if(serverQueue.connection.dispatcher.resumed)
        return message.channel.send("Šak uš to máš obnovení no bi tě rakovyna vzala!");
      serverQueue.connection.dispatcher.resume();
      message.channel.send("Pravjte tet sem to obnovyl!");
    }
    function Loop(args, serverQueue){

      if(!serverQueue.connection)
        return message.channel.send("A co ti mam jako lúpnout kdiš tu nic neni?!");
      if(!message.member.voice.channel)
        return message.channel.send("More prypoj se do toho hlasoviho kanalu ti guto jedna!")

      switch(args[0].toLowerCase()){
        case 'all':
          serverQueue.loopall = !serverQueue.loopall;
          serverQueue.loopone = false;

          if(serverQueue.loopall === true)
            message.channel.send("Pravje tet sem zapl loop all")
          else
            message.channel.send("Pravje tet sem vypl loop all")
          break;
        case 'one':
          serverQueue.loopone = !serverQueue.loopone;
          serverQueue.loopall = false;
          
          if(serverQueue.loopone === true)
            message.channel.send("Pravje tet sem zapl loop one")
          else
            message.channel.send("Pravje tet sem vypl loop one")
          break;
        case 'off':
          serverQueue.loopall = false;
          serverQueue.loopone = false;

          message.channel.send("Tetka sem ti vipl ten lúp");
          break;
        default:
          message.channel.send("More ale řekni co hceš nebo ti viřýznu játra !loop one/all/off");
      }
    }

    function Queue(serverQueue){
      if(!serverQueue.connection)
        return message.channel.send("Šak tu nic neni no bi tě guta vzala za nohi!");
      if(!message.member.voice.channel)
        return message.channel.send("More prypoj se tam nebo ti vyřiznu jatra!")

        let nowPlaying = serverQueue.songs[0];
        let qMsg = `Now playing: ${nowPlaying.title}\n--------------------------\n`

        for(var i = 1; i > serverQueue.songs.length; i++){
          qMsg += `${i}. ${serverQueue.songs[i].title}\n`
        }

        message.channel.send('```' + qMsg + 'Vizadal: ' + message.author.username + '```');
    }
})
 
client.login(process.env.token)