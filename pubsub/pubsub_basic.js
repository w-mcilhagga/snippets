let subscribers = {}

export let subscribe = (topic, subscriber) =>
        (subscribers[topic] ||= new Set()).add(subscriber),
    unsubscribe = (topic, subscriber) => {
        arguments.length == 1
            ? delete subscribers[topic]
            : subscribers[topic]?.remove?.(subscriber)
    },
    publish = (topic, data) => setTimeout(() => send(topic, data), 0)

function send(topic, data) {
    // invoke all the subscribers to the given topic, if any,
    // passing optional data to them.
    for (let subs of subscribers[topic] || []) {
        try {
            subs(topic, data)
        } catch (e) {
            console.log(e)
        }
    }
}
