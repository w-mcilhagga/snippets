# Building a tiny pub-sub system.

pub-sub (publish-subscribe) is a pattern where there are things that send out messages categorized into topics (publishers) and things that  respond to these messages (subscribers). There are a lot of pub-sub libraries out there, some simple and some not. Here we're going to build a pub-sub system in javascript that is small but just as full-featured as the big ones.

A pub-sub system is usually built around two functions:

1. **subscribe**: you call subscribe to register an interest in topics that might be published. Our pub-sub system will have a function `subscribe(topic_string, subscriber_fn)` which declares that the `subscriber_fn` will be called every time the `topic_string` is published.

2. **publish** which publishes topics together with any additional data. Our pub-sub system will have a function `publish(topic_string, data)`. When it's called, then all the subscriber functions for the `topic_string` are executed. Each subscriber function is given the topic string and the data.

### subscribe

We'll deal with subscriptions first. We need to store all the subscribers according to the topics they have subscribed to. An obvious data structure for this is just a plain object:

```javascript
let subscribers = {}
```

Our pub-sub system is going to be an ES6 module, and since we don't want end users playing with the subscribers object, we don't export it.

When we subscribe to a topic, we want to store the subscriber in the object keyed by the topic. One way to do this is to make `subscribers[topic]` a Set of subscribers. A set is better than an Array because it ensures that we can't accidentally subscribe twice to the same topic. Our subscribe function could be

```javascript
export function subscribe(topic, subscriber) {
    if (!subscribers[topic]) {
        subscribers[topic] = new Set()
    }
    subscribers[topic].add(subscriber)
}
```
The if-statement makes sure that there is a set to add the subscriber to. The if statement could be boiled down to `subscribers[topic] ||= new Set()`, and since that statement returns `subscribers[topic]`, we can then add to it, giving us a neat one-liner:

```javascript
export let subscribe = (topic, subscriber) => (subscribers[topic] ||= new Set()).add(subscriber)
```

Unsubscribe is pretty easy with sets:

```javascript
export let unsubscribe(topic, subscriber) => subscribers[topic]?.remove?.(subscriber)
```
The nullish operator `?.` is used because the topic might not exist, and we don't want to throw an exception if that's the case. We might also want to unsubscribe everything from a topic if, for example, we no longer need the topic. We can extend `unsubscribe` so that if no subscriber function is given, all subscribers are removed:

```javascript
export let unsubscribe = (topic, subscriber) => {
        arguments.length == 1
            ? delete subscribers[topic]
            : subscribers[topic]?.remove?.(subscriber)
    },
```

### publish

When we publish a topic, we just call all the subscribers to that topic. So the publish function could look like this:

```javascript
function publish(topic, data) {
    if (subscribers[topic]) {
        for (let subs of subscribers[topic]) {
            subs(topic, data)
        }
    }
}
```

This function checks that there are any subscribers before iterating over the members of the set. This can also be shortened a bit, by folding the test for `subscribers[topic]` into the for-loop, like this

```javascript
function publish(topic, data) {
    for (let subs of subscribers[topic] || []) {
        subs(topic, data)
    }
}
```

Here, if `subscribers[topic]` doesn't exist, we iterate over an empty array.

One problem with this is that the publish is synchronous: the subscribers are all executed immediately the publish function is called. Usually, we want asynchronous publishing, so the subscribers are run after the current task ends. We can do this by breaking publish into two functions: one schedules the publish, and one carries it out. 

```javascript
export let  publish(topic, data) => setTimeout(() => send(topic, data), 0)

function send(topic, data) {
    for (let subs of subscribers[topic] || []) {
        subs(topic, data)
    }
}
```

In this code, the subscribers are invoked by the `send` function. `publish` merely schedules the `send` to occur in the javascript task loop using `setTimeout` with a delay of zero. (This idea is from https://github.com/mroderick/PubSubJS ).

All of this code, which makes a fully functional pub-sub system, can be found in the file `pubsub_basic.js`. In addition, in this file, `send` is altered to ignore any exceptions raised by subscriber functions. Minified, this pub-sub system is only 0.25 kb.

### Example

```html
<script type=module>
    import {publish, subscribe, unsubscribe} from './path/to/pubsub_basic.js'

    subscribe('x', (topic, data) => console.log('subscription1', { topic, data }))
    subscribe('y', (topic, data) => console.log('subscription2', { topic, data }))

    publish('x', 'message 1')
    publish('y', 'message 2')

    console.log('script end')
</script>
```

This produces the following output
```
script end
subscription1 {topic: 'x', data: 'message 1'}
subscription2 {topic: 'y', data: 'message 2'}
```

## Hierarchical Topics.

Some pubsub systems allow you to define a message hierarchy, so that we can have topics like `car.wheel` and `car.seat` which trigger subscribers to these specific topics as well as subscribers to the the higher level topic `car`. We can add this to our library by changing the `send` function:

```javascript
function send(topic, data) {
    for (let subs of subscribers[topic] || []) {
        subs(topic, data)
    }
    topic && send(topic.replace(/(^|\.)[^.]+$/, ''), data)
}
```
TThe last line checks if the topic exists (i.e. it isn't a blank topic `""`), then sends with the topic having the last dotted component (or the whole string if no dots) stripped off with a regular expression. 

The problem with this is that the higher-level subscriber doesn't get the original 
topic, but only the one they subscribe to, so they don't know where the publish 
originated. We can fix this by creating a  
`currenttopic` parameter (which is also passed to the subscriber as the last parameter, so it can be ignored):

```javascript
function send(topic, data, currenttopic=topic) {
    for (let subs of subscribers[currenttopic] || []) {
        subs(topic, data, currenttopic)
    }
    currenttopic && send(topic, data, currenttopic.replace(/(^|\.)[^.]+$/, ''))
}
```

### Example
```html
<script type=module>
    import {publish, subscribe, unsubscribe} from './path/to/pubsub.js'

    subscribe('x.y', (topic, data, current) =>
        console.log('subscription1', { topic, data, current })
    )
    subscribe('x', (topic, data, current) =>
        console.log('subscription2', { topic, data, current })
    )

    publish('x.y.z', 'message 1')
    publish('x.y', 'message 2')

    console.log('script end')
</script>
```

This produces the following output
```
script end
subscription1 {topic: 'x.y.z', data: 'message 1', current: 'x.y'}
subscription2 {topic: 'x.y.z', data: 'message 1', current: 'x'}
subscription1 {topic: 'x.y', data: 'message 2', current: 'x.y'}
subscription2 {topic: 'x.y', data: 'message 2', current: 'x'}
```

### Bubbling.

Hierarchical topics are similar to event bubbling in the DOM. However, the bubbling
always takes place in the above code, and there might be a need to cancel it. We can adjust the send function to allow handlers to cancel bubbling, as follows;

```javascript
function send(topic, data, currenttopic=topic, stop = false) {
    for (let subs of subscribers[currenttopic] || []) {
        stop = subs(topic, data, currenttopic) || stop
    }
    stop != 'stopPropagation' 
        && currenttopic && send(topic, data, currenttopic.replace(/(^|\.)[^.]+$/, ''))
}
```
In this version of `send` if any subscriber returns the string `'stopPropagation'`, then the bubbling upwards is prevented.

The hierarchical pub-sub system together with cancelling bubbling can be found in the file `pubsub.js`, which minified (in `pubsub.min.js`) is only 0.33 kb. (Note: the minified version renames the `subscribers` object as `q` for extra space saving.)

### Example.
```html
<script type=module>
    import {publish, subscribe, unsubscribe} from './path/to/pubsub.js'

    subscribe('x.y', (topic, data, current) => {
        console.log('subscription1', { topic, data, current })
        return data == 'message 2' && 'stopPropagation'
    })
    subscribe('x', (topic, data, current) =>
        console.log('subscription2', { topic, data, current })
    )

    publish('x.y.z', 'message 1')
    publish('x.y', 'message 2')

    console.log('script end')
</script>
```

This produces the following output
```
script end
subscription1 {topic: 'x.y.z', data: 'message 1', current: 'x.y'}
subscription2 {topic: 'x.y.z', data: 'message 1', current: 'x'}
subscription1 {topic: 'x.y', data: 'message 2', current: 'x.y'}
```

Here the 'stopPropagation' in the first subscriber cancelled the call to the higher-up subscriber with  data equal to 'message 2'