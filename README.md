> <span style="color:red;font-weight:bold">NOTE:</span> A newer browser version to  play without installing any additional software and with a simpler configuration has been created. Just visit this link for that version:</br>
https://andrescavallin.github.io/lichess-dgt-boards-browser/

>Improvements will be made to the new browser version only. The GitHub project can be found here:
https://github.com/andrescavallin/lichess-dgt-boards-browser

---


<div id='wrapper' style='text-align: center;'>
    <div style='display: inline-block; vertical-align: middle;'>
        <a href="https://www.digitalgametechnology.com/index.php/products/electronic-boards">
        <img width="128" alt="DGT Logo" src="https://www.digitalgametechnology.com/images/DGT_The_Chess_Innovators.jpg"></a>
        <br/>
    </div>
    <div style='display: inline-block; vertical-align: middle;'>
        <a title="ornicar / AGPL (http://www.gnu.org/licenses/agpl.html)" href="https://lichess.org">
        <img width="110" alt="Lichess Logo" src="https://upload.wikimedia.org/wikipedia/commons/a/af/Lichess_Logo.svg"></a>
        <br/>lichess.org
    </div>
</div>


<!-- [![FVCproductions](https://avatars1.githubusercontent.com/u/4284691?v=3&s=200)](http://fvcproductions.com) -->



# lichess-dgt-boards

> Play on <a hred="https://lichess.org/">Lichess.org</a> using your <a href="https://www.digitalgametechnology.com/index.php/products/electronic-boards">DGT Electronic Board</a> as input. Incoming moves can be played on audio devices or displayed on the screen. This code can easily be adaptaed to play with other boards.


> The program works by connecting to Lichess via the Board API set of APIs, and to the DGT Board by opening a websocket connecting to the free LiveChess 2.2 which is the software DGT developed to broadcast tournaments. When moves are played on the board the program will detect those and send them to Lichess, and moves played on lichess by your opponent will be announced on screen and by audio, and they need to be executed on the board manually. Text to speech is provided by IBM Watson, and several languages are supported.

---

## Table of Contents

- [Requirements](#Requirements)
- [Configuration](#Configuration)
- [License](#license)

---
### Requirements

- DGT Board
    - Any **DGT Electronic Board** including Smart Board, Blue Tooth, USB and Serial Boards [https://www.digitalgametechnology.com/index.php/products/electronic-boards]
    - **LiveChess 2.2** Software installed, opened and able to see the board 
    [http://www.livechesscloud.com/software/]
- Lichess
    - A **Lichess.org** online account 
    [https://lichess.org/signup]
    - A Lichess **API Token** with the following scopes 
    [https://lichess.org/account/oauth/token/create?scopes[]=board:play&scopes[]=preference:read&scopes[]=challenge:read&scopes[]=challenge:write&scopes[]=msg:write&description=DGT+Board]
        - Play games with the board API
        - Read preferences
        - Read incoming challenges (coming soon)
        - Create, accept, decline challenges (coming soon)
        - Send private messages to other players (coming soon)
    - oAuth not currently supported, only API Token. See Above
- This Application
    - **Node.js** v12.16.2 LTS or Above 
    [https://nodejs.org/]
    - Install all dependencies by using `>npm install` on this app folder
    - In the future stand alone executable will be provided
- Text To Speech
    - Command line audio player
        - On Mac OS X **afplay** is already present
        - On Windows 10 get **cmdmp3**
        [https://github.com/jimlawless/cmdmp3]
        - On Linux or practically any OS get **mpg123**
        [http://mpg123.org/]
    - IBM Cloud Account
        - IBM Cloud - Free **Watson Text to Speech** Account
        [https://www.ibm.com/cloud/watson-text-to-speech]
        - IBM Cloud **API Key** 
        [https://cloud.ibm.com/iam/apikeys]
- Companion Web App
    - Pending/TODO a Companion Web App to see clock and Text To Speech on Mobile Phone or Tablet next to the physical DGT Board.

[![Build Status](http://img.shields.io/travis/badges/badgerbadgerbadger.svg?style=flat-square)](https://travis-ci.org/badges/badgerbadgerbadger) [![Dependency Status](http://img.shields.io/gemnasium/badges/badgerbadgerbadger.svg?style=flat-square)](https://gemnasium.com/badges/badgerbadgerbadger) [![Coverage Status](http://img.shields.io/coveralls/badges/badgerbadgerbadger.svg?style=flat-square)](https://coveralls.io/r/badges/badgerbadgerbadger) [![Code Climate](http://img.shields.io/codeclimate/github/badges/badgerbadgerbadger.svg?style=flat-square)](https://codeclimate.com/github/badges/badgerbadgerbadger) [![Github Issues](http://githubbadges.herokuapp.com/badges/badgerbadgerbadger/issues.svg?style=flat-square)](https://github.com/badges/badgerbadgerbadger/issues) [![Pending Pull-Requests](http://githubbadges.herokuapp.com/badges/badgerbadgerbadger/pulls.svg?style=flat-square)](https://github.com/badges/badgerbadgerbadger/pulls) [![Gem Version](http://img.shields.io/gem/v/badgerbadgerbadger.svg?style=flat-square)](https://rubygems.org/gems/badgerbadgerbadger) [![License](http://img.shields.io/:license-mit-blue.svg?style=flat-square)](http://badges.mit-license.org) [![Badges](http://img.shields.io/:badges-9/9-ff6799.svg?style=flat-square)](https://github.com/badges/badgerbadgerbadger)


---

## Configuration 
> This a sample content of `config.json` that needs to be on the same path as the app.js file. All values are valid except for the `personalToken` and `Watson_APIKEY` that you need to obtain yourself and update this file.

config.json

```javascript
{
  "baseURL": "https://lichess.org",
  "personalToken": "__Your Token__",
  "verbose": false,
  "announceAllMoves": false,
  "announceMoveFormat": "san",
  "splitWords": false,
  "voice": "Allison",
  "availableVoices": {
    "Allison": "en-US_AllisonV3Voice",
    "Michael": "en-US_MichaelV3Voice",
    "Sofia": "es-LA_SofiaV3Voice",
    "Enrique": "es-ES_EnriqueV3Voice",
    "Renee": "fr-FR_ReneeV3Voice",
    "Francesca": "it-IT_FrancescaV3Voice"
  },
  "Watson_APIKEY": "__Your APIKEY__",
  "audioFormat": "mp3",
  "windowsAudioPlayer": "./audioplayer/cmdmp3/cmdmp3.exe",
  "keywords": {
    "K": "King",
    "Q": "Queen",
    "R": "Rook",
    "B": "Bishop",
    "N": "Knight",
    "P": "Pawn",
    "x": "Takes",
    "+": "Check",
    "#": "Checkmate",
    "(=)": "Game ends in draw",
    "O-O": "Castles kingside",
    "O-O-O": "Castles queenside",
    "white": "White",
    "black": "Black",
    "wins by": "wins by",
    "timeout": "timeout",
    "resignation": "resignation",
    "illegal": "illegal",
    "move": "move"
  }
}
```
> Explanation of each value

 - <span style="font-weight:bold">"baseURL": "https://lichess.org"</span><p>The base URL for Lichess. Use https://lichess.org unless you need to target development environments or your own Lichess fork.</p>
 - <span style="font-weight:bold">"personalToken": "__Your Token__"</span> <p>This is your lichess token obtained from <a href="https://lichess.org/account/oauth/token/create?scopes[]=board:play&scopes[]=preference:read&scopes[]=challenge:read&scopes[]=challenge:write&scopes[]=msg:write&description=DGT+Board">Personal API access token</a></p>
 - <span style="font-weight:bold">"verbose": false</span> <p>Set this as `false` unless you want to debug connectivity with lihcess or the DGT Board</p>
 - <span style="font-weight:bold">"announceAllMoves": false</span> <p>When set to `false` will only announce moves from opponent, when set to `true`, will annouce all moves.</p>
 - <span style="font-weight:bold">"announceMoveFormat": "san"</span> <p>Possible values are `san` and `uci` . San is nicer but will require more storage for Text To Speech since it includes the name the of the piece, while uci only includes origin and target squares</p>
 - <span style="font-weight:bold">"splitWords": false</span> <p>When set to `true` the Text To Speech will generate separete audio file for the name of the pieces and the target squares, saving disk space. This will create a long pause between the name of the piece and the target square that may be a little bit annoying but acceptable. When set to `false` each san move will become an audio file </p>
 - <span style="font-weight:bold">"voice": "Allison"</span> <p>The name of the Text To Speech persona used by IBM Watson for generating the audio file. The full list can be found at <a href="https://cloud.ibm.com/docs/text-to-speech?topic=text-to-speech-voices#voices">Languages and voices</a>. The voice needs to be added to the object availableVoices that has both the short name and the IBM Watson full name. Like this:</p>
 "availableVoices": 
    - "Allison": "en-US_AllisonV3Voice"
    - "Michael": "en-US_MichaelV3Voice"
    - "Sofia": "es-LA_SofiaV3Voice"
    - "Enrique": "es-ES_EnriqueV3Voice"
    - "Renee": "fr-FR_ReneeV3Voice"
    - "Francesca": "it-IT_FrancescaV3Voice"

 - <span style="font-weight:bold">"Watson_APIKEY": "__Your APIKEY__"</span> <p>We are not endorsing IBM Watson Text To Speech in any way, it is just the web service that we selected because of the free tier and because V3 personas sound really real. You will need to <a href="https://cloud.ibm.com/docs/text-to-speech">signup</a> and then you can request the API Key <a href="https://cloud.ibm.com/resources">here</a></p>
 - <span style="font-weight:bold">"audioFormat": "mp3"</span><p>The MIME Type like `wav` or `mp3`. The full list of supported formats can be found at <a href="https://cloud.ibm.com/apidocs/text-to-speech#synthesize-audio">Audio formats (accept types)</a></p>
 - <span style="font-weight:bold">"windowsAudioPlayer": "./audioplayer/cmdmp3/cmdmp3.exe"</span><p>On MacOS the command line audio player `afplay` is used. But on Windows a tool is needed. This value represents the path to the command line audio player tool. Remember to download this tool for Text To Speech to work on Windows when you want the audio to be played on the host machine.</p>
 - <span style="font-weight:bold">"keywords": {...}</span><p>This object contains the english words what will be used to tranlate san moves into an announcement. If you want to use spanish for example, replace the values, as in this sample:</p>


```javascript

    "keywords": {
        "K": "Rey",
        "Q": "Dama",
        "R": "Torre",
        "B": "Alfil",
        "N": "Caballo",
        "P": "Peón",
        "x": "Por",
        "+": "Jaque",
        "#": "Jaquemate",
        "(=)": "Juego termina en Tablas",
        "O-O": "Enroque corto",
        "O-O-O": "Enroque largo",
        "white": "Blancas",
        "black": "Negras",
        "wins by": "ganan por",
        "timeout": "timeout",
        "resignation": "dimisión",
        "illegal": "incorrecta",
        "move": "jugada"
    }

```

---

## License

[![License](http://img.shields.io/:license-mit-blue.svg?style=flat-square)](http://badges.mit-license.org)

- **[MIT license](http://opensource.org/licenses/mit-license.php)**
- Developed during April - June 2020