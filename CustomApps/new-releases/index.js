// Run "npm i @type/react" to have this type package available in workspace
/// <reference types="react" />

/** @type {React} */
const {
    URI,
    React: react,
    React: { useState, useEffect, useCallback },
    ReactDOM: reactDOM,
    Platform: { History },
    CosmosAsync,
} = Spicetify;

// Define a function called "render" to specify app entry point
// This function will be used to mount app to main view.
function render() {
    return react.createElement(Grid);
}

function getConfig(name, defaultVal = true) {
    const value = localStorage.getItem(name);
    return value ? value === "true" : defaultVal;
}

const APP_NAME = "new-releases";

const CONFIG = {
    visual: {
        type: getConfig("new-releases:visual:type", true),
        count: getConfig("new-releases:visual:count", true),
    },
    podcast: getConfig("new-releases:podcast", false),
    music: getConfig("new-releases:music", true),
    album: getConfig("new-releases:album", true),
    ["single-ep"]: getConfig("new-releases:single-ep", true),
    ["appears-on"]: getConfig("new-releases:appears-on", false),
    compilations: getConfig("new-releases:compilations", false),
    range: localStorage.getItem("new-releases:range") || "30",
};

let gridList = [];
let lastScroll = 0;

let gridUpdatePostsVisual;

let today = new Date();
CONFIG.range = parseInt(CONFIG.range) || 30;
let limitInMs = CONFIG.range * 24 * 3600 * 1000;
const dateFormat = {
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "numeric"
};
let seperatedByDate = {};
let dateList = [];

class Grid extends react.Component {
    constructor() {
        super();
        this.state = {
            cards: [],
            rest: true,
        }
    }

    updatePostsVisual() {
        gridList = [];
        for (const date of dateList) {
            gridList.push(react.createElement("div", {
                className: "new-releases-header"
            }, react.createElement("h2", null, date)),
            react.createElement("div", {
                className: "main-gridContainer-gridContainer",
                style: {
                    "--minimumColumnWidth": "180px"
                },
            }, seperatedByDate[date].map(card => react.createElement(Card, card.props))));
        }
        this.setState({ cards: [...gridList] });
    }

    async reload() {
        gridList = [];
        seperatedByDate = {};
        dateList = [];

        today = new Date();
        CONFIG.range = parseInt(CONFIG.range) || 30;
        limitInMs = CONFIG.range * 24 * 3600 * 1000;

        this.setState({ rest: false });
        let items = [];
        if (CONFIG.music) {
            let tracks = await fetchTracks();
            items.push(...(tracks.flat()));
        }
        if (CONFIG.podcast) {
            let episodes = await fetchPodcasts();
            items.push(...episodes);
        }

        // TODO: Config sort Asc, desc
        items = items.filter(a => a).sort((a, b) => b.time - a.time);

        for (const track of items) {
            track.visual = CONFIG.visual;
            track.time = track.time.toLocaleDateString(navigator.language, dateFormat);
            if (!seperatedByDate[track.time]) {
                dateList.push(track.time);
                seperatedByDate[track.time] = [];
            }
            seperatedByDate[track.time].push(react.createElement(Card, track));
        }

        for (const date of dateList) {
            gridList.push(react.createElement("div", {
                className: "new-releases-header"
            }, react.createElement("h2", null, date)),
            react.createElement("div", {
                className: "main-gridContainer-gridContainer",
                style: {
                    "--minimumColumnWidth": "180px"
                },
            }, seperatedByDate[date]));
        }

        this.setState({ rest: true });
    }

    async componentDidMount() {
        gridUpdatePostsVisual = this.updatePostsVisual.bind(this);

        const viewPort = document.querySelector("main .os-viewport");

        if (gridList.length) { // Already loaded
            if (lastScroll > 0) {
                viewPort.scrollTo(0, lastScroll);
            }
            return;
        }

        this.reload();
    }

    componentWillUnmount() {
        const viewPort = document.querySelector("main .os-viewport");
        lastScroll = viewPort.scrollTop;
    }

    render() {
        return react.createElement("section", {
            className: "contentSpacing"
        },  react.createElement("div", {
            className: "new-releases-header",
        }, react.createElement("h1", null, "New Releases"),
        react.createElement("div", {
            className: "new-releases-controls-container"
        }, react.createElement(ButtonText, {
            text: "Refresh",
            onClick: this.reload.bind(this),
        }), react.createElement(ButtonSVG, {
            icon: Spicetify.SVGIcons.edit,
            onClick: openConfigMenu,
        }))),
        this.state.rest ? gridList : LoadingIcon);
    }
}

async function getArtistList() {
    const body = await CosmosAsync.get(
        "sp://core-collection/unstable/@/list/artists/all?responseFormat=protobufJson",
        { policy: { list: { link: true, name: true } } }
    );
    return body.item;
}

async function getArtistEverything(artist) {
    const uid = artist.link.replace("spotify:artist:", "");
    const body = await CosmosAsync.get(`hm://artist/v3/${uid}/desktop/entity?format=json`);
    const releases = body?.releases;
    const items = [];
    const types = [
        [CONFIG.album, releases?.albums?.releases, "Album"],
        [CONFIG["appears-on"], releases?.appears_on?.releases, "Appears On"],
        [CONFIG.compilations, releases?.compilations?.releases, "Compilation"],
        [CONFIG["single-ep"], releases?.singles?.releases, "Single/EP"],
    ]
    for (const type of types) {
        if (type[0] && type[1]) {
            for (const item of type[1]) {
                const meta = metaFromTrack(artist, item);
                if (!meta) continue;
                meta.type = type[2];
                items.push(meta);
            }
        }
    }
    return items;
}

async function getPodcastList() {
    const body = await CosmosAsync.get("sp://core-collection/unstable/@/list/shows/all?responseFormat=protobufJson");
    return body.item;
}

async function getPodcastRelease(uri) {
    const body = await CosmosAsync.get(`sp://core-show/unstable/show/${uri}`);
    return body.items;
}

function metaFromTrack(artist, track) {
    const time = new Date(track.year, track.month - 1, track.day)
    if ((today - time.getTime()) < limitInMs) {
        return ({
            uri: track.uri,
            title: track.name,
            artist: {
                name: artist.name,
                uri: artist.link,
            },
            imageURL: track.cover.uri,
            time,
            trackCount: track.track_count,
        })
    }
    return null;
}

async function fetchTracks() {
    let artistList = await getArtistList()

    const requests = artistList.map(async (obj) => {
        const artist = obj.artistMetadata;

        return await getArtistEverything(artist);
    })

    return await Promise.all(requests)
}

async function fetchPodcasts() {
    const items = [];
    for (const obj of await getPodcastList()) {
        const podcast = obj.showMetadata;
        const id = podcast.link.replace("spotify:show:", "");

        const tracks = await getPodcastRelease(id);
        if (!tracks) continue;

        for (const track of tracks) {
            const time = new Date(track.publishDate * 1000);

            if ((today - time.getTime()) > limitInMs) {
                break;
            }

            items.push(({
                uri: track.link,
                title: track.name,
                artist: podcast.name,
                imageURL: track.covers.default,
                time,
                type: "Episode",
            }));
        }
    }

    return items;
}