const ButtonSVG = ({ icon, active = true, onClick }) => {
    return react.createElement("button", {
        className: "switch" + (active ? "" : " disabled"),
        onClick,
    }, react.createElement("svg", {
        width: 16,
        height: 16,
        viewBox: "0 0 16 16",
        fill: "currentColor",
        dangerouslySetInnerHTML: {
            __html: icon,
        }
    }))
};

const SwapButton = ({ icon, disabled, onClick }) => {
    return react.createElement("button", {
        className: "switch small",
        onClick,
        disabled,
    }, react.createElement("svg", {
        width: 10,
        height: 10,
        viewBox: "0 0 16 16",
        fill: "currentColor",
        dangerouslySetInnerHTML: {
            __html: icon,
        }
    }))
};

const ConfigSlider = ({ name, defaultValue, onChange = () => { } }) => {
    const [active, setActive] = useState(defaultValue);

    const toggleState = useCallback(() => {
        const state = !active;
        setActive(state);
        onChange(state);
    }, [active]);

    return react.createElement("div", {
        className: "setting-row",
    }, react.createElement("label", {
        className: "col description",
    }, name), react.createElement("div", {
        className: "col action",
    }, react.createElement(ButtonSVG, {
        icon: Spicetify.SVGIcons.check,
        active,
        onClick: toggleState,
    })));
};

const ConfigInput = ({ name, defaultValue, onChange = () => { } }) => {
    const [value, setValue] = useState(defaultValue);

    const setValueCallback = useCallback((event) => {
        const value = event.target.value;
        setValue(value);
        onChange(value);
    }, [value]);

    return react.createElement("div", {
        className: "setting-row",
    }, react.createElement("label", {
        className: "col description",
    }, name), react.createElement("div", {
        className: "col action",
    }, react.createElement("input", {
        value,
        onChange: setValueCallback,
    })));
};
const ServiceOption = ({
    item,
    onToggle,
    onSwap,
    isFirst = false,
    isLast = false,
    onTokenChange = null
}) => {
    const [token, setToken] = useState(item.token);
    const [active, setActive] = useState(item.on);

    const setTokenCallback = useCallback((event) => {
        const value = event.target.value;
        setToken(value);
        onTokenChange(item.name, value);
    }, [item.token]);

    const toggleActive = useCallback(() => {
        const state = !active;
        setActive(state);
        onToggle(item.name, state);
    }, [active]);

    return react.createElement("div", null,
    react.createElement("div", {
        className: "setting-row",
    }, react.createElement("h3", {
        className: "col description",
    }, item.name), react.createElement("div", {
        className: "col action",
    }, react.createElement(SwapButton, {
        icon: Spicetify.SVGIcons["chart-up"],
        onClick: () => onSwap(item.name, -1),
        disabled: isFirst,
    }), react.createElement(SwapButton, {
        icon: Spicetify.SVGIcons["chart-down"],
        onClick: () => onSwap(item.name, 1),
        disabled: isLast,
    }), react.createElement(ButtonSVG, {
        icon: Spicetify.SVGIcons.check,
        active,
        onClick: toggleActive,
    }))),
    react.createElement("span", {
        dangerouslySetInnerHTML: {
            __html: item.desc,
        }
    }),
    (item.token !== undefined) && react.createElement("input", {
        placeholder: `Place your ${item.name} token here`,
        value: token,
        onChange: setTokenCallback,
    }));
};

const ServiceList = ({
    itemsList,
    onListChange = () => { },
    onToggle = () => { },
    onTokenChange = () => { },
}) => {
    const [items, setItems] = useState(itemsList);
    const maxIndex = items.length - 1;

    const onSwap = useCallback((name, direction) => {
        const curPos = items.findIndex((val) => val === name);
        const newPos = curPos + direction;
        [items[curPos], items[newPos]] = [items[newPos], items[curPos]];
        onListChange(items);
        setItems([...items]);
    }, [items]);

    return items.map((key, index) => {
        const item = CONFIG.providers[key];
        item.name = key;
        return react.createElement(ServiceOption, {
            item,
            key,
            isFirst: index === 0,
            isLast: index === maxIndex,
            onSwap,
            onTokenChange,
            onToggle,
        });
    });
};

const OptionList = ({ items, onChange }) => {
    const [ _, setItems ] = useState(items);
    return items.map(item => {
        if (!item.when()) {
            return;
        }
        return react.createElement(item.type, {
            name: item.desc,
            defaultValue: item.defaultValue,
            onChange: (value) => {
                onChange(item.key, value);
                setItems([...items]);
            },
        });
    })
};

function openConfigMenu(event) {
    event.preventDefault();

    const configContainer = react.createElement("div", {
        id: `${APP_NAME}-config-container`,
    }, react.createElement("h2", null, "Options"),
        react.createElement(OptionList, {
            items: [
                {
                    desc: "Noise overlay",
                    key: "noise",
                    defaultValue: CONFIG.visual["noise"],
                    type: ConfigSlider,
                    when: () => true,
                },
                {
                    desc: "Colorful background",
                    key: "colorful",
                    defaultValue: CONFIG.visual["colorful"],
                    type: ConfigSlider,
                    when: () => true,
                },
                {
                    desc: "Background color",
                    key: "background-color",
                    defaultValue: CONFIG.visual["background-color"],
                    type: ConfigInput,
                    when: () => !CONFIG.visual["colorful"],
                },
                {
                    desc: "Active text color",
                    key: "active-color",
                    defaultValue: CONFIG.visual["active-color"],
                    type: ConfigInput,
                    when: () => !CONFIG.visual["colorful"],
                },
                {
                    desc: "Inactive text color",
                    key: "inactive-color",
                    defaultValue: CONFIG.visual["inactive-color"],
                    type: ConfigInput,
                    when: () => !CONFIG.visual["colorful"],
                },
                {
                    desc: "Highlight text background",
                    key: "highlight-color",
                    defaultValue: CONFIG.visual["highlight-color"],
                    type: ConfigInput,
                    when: () => !CONFIG.visual["colorful"],
                }
            ],
            onChange: (name, value) => {
                CONFIG.visual[name] = value;
                localStorage.setItem(`${APP_NAME}:visual:${name}`, value);
                lyricContainerUpdate && lyricContainerUpdate();
            },
        }),
        react.createElement("h2", null, "Providers"),
        react.createElement(ServiceList, {
            itemsList: CONFIG.providersOrder,
            onListChange: (list) => {
                CONFIG.providersOrder = list;
                localStorage.setItem(`${APP_NAME}:services-order`, JSON.stringify(list));
            },
            onToggle: (name, value) => {
                CONFIG.providers[name].on = value;
                localStorage.setItem(`${APP_NAME}:provider:${name}:on`, value);
            },
            onTokenChange: (name, value) => {
                CONFIG.providers[name].token = value;
                localStorage.setItem(`${APP_NAME}:provider:${name}:token`, value);
            },
        })
    );

    Spicetify.PopupModal.display({
        title: "Lyrics Plus",
        content: configContainer,
    });
}
