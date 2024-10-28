# Minimalist pubsub

The smallest pubsub library I can imagine:

```javascript
let subscribers = {},
    subscribe = (topic, handler) => (subscribers[topic] ||= []).push(handler),
    publish = (topic, data) => setTimeout(() => send(topic, data), 0),
    send = (topic, data)  => subscribers[topic]?.forEach?.(
        handler => handler(topic, data)
    )
```

Let's walk through it:

1. `subscribers = {}`

    This creates the object to hold the subscribers.

2. `subscribe = (topic, handler) => (subscribers[topic] ||= []).push(handler)`

    This subscribes a handler function to a topic. The `(subscribers[topic] ||= [])` ensures there is an array to hold all the topic's subscribers, and `.push(handler)` adds the handler to that array.

3. `publish = (topic, data) => setTimeout(() => send(topic, data), 0)`

    This puts a call to `send` on the task queue. Exploiting the task queue is why this library is so small (idea stolen from https://github.com/mroderick/PubSubJS ).

4. `send = (topic, data)  => subscribers[topic]?.forEach?.(handler => handler(topic, data))`

    This grabs the array of subscribers and, if it exists, iterates over the saved handlers calling them with the topic & data. It uses the nullish operator `?.` in case the topic has no subscribers.

This is missing an `unsubscribe` function. If you need it, here it is (it's as long as the whole pubsub system above !):

```javascript
function unsubscribe(topic, handler) {
    let idx = subscribers[topic]?.indexOf?.(handler)
    handler
        ? idx >= 0 && subscribers[topic].splice(idx, 1)
        : delete subscribers[topic]
}
```
First, this gets the index into the subscriber array that matches the handler, if any. If no handler is supplied, all subscribers are removed, otherwise just the matching one.

### Hierarchical Messages.

Many pubsub systems allow you to define messages in a hierarchy, so that we may have a topic like `car.wheel` and `car.seat` which can trigger subscribers to the specific topics as well as subscribers to the the more general topic `car`. We can add this functionality to this library by changing the `send` function:

```javascript
    let send = (topic, data) => {
            topic && subscribers[topic]?.forEach?.(handler => handler(topic, data))
            topic && send(topic.replace(/(^|\.)[^.]+$/, ''), { topic, data })
        }
```
The first line of this is just the original `send` function. The next line checks
if the topic exists (i.e. it isn't a blank topic `""`), then sends to the topic with the last dotted component (or the whole string if no dots) stripped off with a regular expression. 

### Documentation

Include the pubsub library using a script tag 
`<script src="path/to/pubsub.js"></script>`. Then you can use the
following three functions:

* `subscribe(topic, handler)`

   * `topic`: string
   * `handler`: a function with signature `handler(topic, data)` where topic is
      the topic string which was published, and data is an arbitrary object.

   This subscribes the handler function to the topic. It will be called whenever the
   topic is published.

* `publish(topic, data)`

   * `topic`: string
   * `data`: object

   This publishes the topic and associated data, if any. The subscribers to the topic
   are called when the task queue gets around to it. The topic may be a hierarchical 
   topic, e.g. `"a.b.c"`. In this case, all subscribers to `"a.b.c"` are called first, then all subscribers to `"a.b"`, then all subscribers to `"a"`. In each case, the
   data object contains the topic and the data passed to the lower level of subscriber.

* `unsubscribe(topic, handler)`

  * `topic`: string
  * `handler`: either absent or a handler previously passed to subscribe.

  If handler is present, it is unsubscribed from the given topic. If handler is absent, all handlers of the given topic are unsubscribed.

### Example.
```html
<script src="pubsub.js"></script>
<script>
    subscribe('x', (...args) => console.log('subscription1', ...args))
    subscribe('x.y', (topic, data) => {
        console.log('subscription2', topic, data)
    })

    publish('x.y.z', 'message 1')
    publish('x.y', 'message 2')

    console.log('script end')
</script>
```

This produces the following output
```
script end
subscription2 x.y {topic: 'x.y.z', data: 'message 1'}
subscription1 x {topic: 'x.y', data: {topic: 'x.y.z', data: 'message 1'}}
subscription2 x.y message 2
subscription1 x {topic: 'x.y', data: 'message 2'}
```

Notive that when the subscribers higher up the chain (e.g. the subscriber to 'x') gets the data, it's the topic & data fed to the previous subscriber. In the third line of the output above, the data object is doubly nested, and shows that the topic was originally `'x.y.z'`

### Bubbling.

The hierarchical system is similar to event bubbling in the DOM. However, the bubbling
always takes place, and there might be a need to cancel it. We can adjust the send function to allow handlers to cancel bubbling, as follows;

```javascript
    let send = (topic, data, stop = false) => {
        subscribers[topic]?.forEach?.((handler) => (stop = handler(topic, data) || stop))
        topic &&
            stop != 'stopPropagation' &&
            send(topic.replace(/(^|\.)[^.]+$/, ''), { topic, data })
    }
```
Here, if any handler returns the string `'stopPropagation'`, then the bubbling upwards 
is prevented.

#### Bubbling Example:
```html
<script src="pubsub.js"></script>
<script>
    subscribe('x', (...args) => console.log('subscription1', ...args))
    subscribe('x.y', (topic, data) => {
        console.log('subscription2', topic, data)
        return 'stopPropagation'
    })

    publish('x.y.z', 'message 1')
    console.log('script end')
</script>
```

This gives
```
script end
subscription2 x.y {topic: 'x.y.z', data: 'message 1'}
```
In this case, the propagation to topic `x` was stopped by an `x.y` handler.

The whole of this hierarchical pubsub system with stop bubbling is available in the file `pubsub.js` (0.7 kb unzipped).