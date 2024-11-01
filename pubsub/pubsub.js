let subscribers = {}

export let subscribe = (topic, subscriber) =>
        (subscribers[topic] ||= new Set()).add(subscriber),
    unsubscribe = (topic, subscriber) => {
        arguments.length == 1
            ? delete subscribers[topic]
            : subscribers[topic]?.remove?.(subscriber)
    },
    publish = (topic, data) => setTimeout(() => send(topic, data), 0)

function send(topic, data, currenttopic = topic, stop = false) {
    for (let subs of subscribers[currenttopic] || []) {
        try {
            stop = subs(topic, data, currenttopic) || stop
        } catch (e) {
            console.log(e)
        }
    }
    stop != 'stopPropagation' &&
        currenttopic &&
        send(topic, data, currenttopic.replace(/(^|\.)[^.]+$/, ''))
}
