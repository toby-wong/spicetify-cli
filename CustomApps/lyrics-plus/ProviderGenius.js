const ProviderGenius = (function () {
    function getChildDeep(parent, isDeep = false) {
        let acc = "";

        if (!parent.children) {
            return acc;
        }

        for (const child of parent.children) {
            if (typeof child == "string") {
                acc += child;
            } else if (child.children) {
                acc += getChildDeep(child, true);
            }
            if (!isDeep) {
                acc += "\n";
            }
        }
        return acc.trim();
    }

    async function getNote(el) {
        let id = el.pathname.match(/\/(\d+)\//);
        if (!id) {
            id = el.dataset.id;
        } else {
            id = id[1];
        }
        
        const body = await CosmosAsync.get(`https://genius.com/api/annotations/${id}`);
        const response = body.response;
        let note = "";

        // Authors annotations
        if (response.referent && response.referent.classification == "verified") {
            const referentsBody = await CosmosAsync.get(`https://genius.com/api/referents/${id}`);
            const referents = referentsBody.response;
            for (const ref of referents.referent.annotations) {
                note += getChildDeep(ref.body.dom);
            }
        }

        // Users annotations
        if (!note && response.annotation) {
            note = getChildDeep(response.annotation.body.dom);
        }

        // Users comments
        if (!note && response.annotation && response.annotation.top_comment) {
            note += getChildDeep(response.annotation.top_comment.body.dom);
        }
        note = note.replace(/\n\n\n?/, "\n");

        return note;
    }

    function fetchHTML(url) {
        return new Promise((resolve, reject) => {
            const request = JSON.stringify({
                method: "GET",
                uri: url,
            });

            window.sendCosmosRequest({
                request,
                persistent: false,
                onSuccess: resolve,
                onFailure: reject,
            })
        });
    }

    async function fetchLyricsVersion(results, index) {
        const result = results[index];
        if (!result) {
            console.warn(result)
            return;
        }

        const site = await fetchHTML(result.url);
        const body = JSON.parse(site)?.body;
        if (!body) {
            return null;
        }

        let lyrics = body.match(/<div class="lyrics">(.+?)<\/div>/s);
        if (lyrics) {
            return lyrics[1];
        }

        const lyricsSections = body.match(/<div class="Lyrics__Container.+?>.+?<\/div>/sg);
        if (!lyricsSections) {
            return null;
        }

        lyrics = "";
        for (const section of lyricsSections) {
            const fragment = section.match(/<div class="Lyrics__Container.+?>(.+?)<\/div>/s);
            if (fragment) {
                lyrics += fragment[1];
            }
        }
        if (!lyrics.length) {
            console.warn("forceError");
            return null;
        }

        return lyrics;
    }

    async function fetchLyrics(info) {
        const url = `https://genius.com/api/search/song?per_page=10&q=${encodeURIComponent(info.artist)}%20${encodeURIComponent(info.title)}`;

        const geniusSearch = await CosmosAsync.get(url);

        const hits = geniusSearch.response.sections[0].hits
            .map(item => ({
                title: item.result.full_title,
                url: item.result.url,
            }));

        if (!hits.length) {
            return { lyrics: null, versions: [] };
        }

        const lyrics = await fetchLyricsVersion(hits, 0);

        return {lyrics, versions: hits};
    }

    return { fetchLyrics, getNote, fetchLyricsVersion }
})();