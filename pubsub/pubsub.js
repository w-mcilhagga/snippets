let subscribers = {},
    subscribe = (topic, handler) => (subscribers[topic] ||= []).push(handler),
    publish = (topic, data) => setTimeout(() => send(topic, data), 0),
    send = (topic, data, stop = false) => {
        topic &&
            subscribers[topic]?.forEach?.(
                (handler) => (stop = handler(topic, data) || stop)
            )
        topic &&
            stop != 'stopPropagation' &&
            send(topic.replace(/(^|\.)[^.]+$/, ''), { topic, data })
    },
    unsubscribe = (topic, handler) => {
        let idx = subscribers[topic]?.indexOf?.(handler)
        handler
            ? idx >= 0 && subscribers[topic].splice(idx, 1)
            : delete subscribers[topic]
    }
