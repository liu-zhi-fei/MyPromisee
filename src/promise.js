const Pending = 'Pending'
const Fulfilled = 'Fulfilled'
const Rejected = 'Rejected'

// 只能执行一个
function callOnes(a, b) {
    let canCalled = true
    
    function warp(fn) {
        return (...args) => {
            if (canCalled) {
                fn(...args)
            }
            canCalled = false
        }
    }
    
    return [warp(a), warp(b)]
}

const isObject = v => v !== null && typeof v === 'object' || typeof v === 'function'

class MyPromise {
    status = Pending
    reaction = []
    value = undefined
    
    static resolve(v) {
        if (v instanceof MyPromise) { return v }
        return new MyPromise((resolve) => resolve(v))
    }
    
    static reject(reason) {
        return new MyPromise((_, reject) => reject(reason))
    }
    
    
    constructor(executor) {
        const [resolve, reject] = callOnes(this.#resolve, this.#reject)
        try {
            executor(resolve, reject)
        } catch (e) {
            reject(e)
        }
    }
    
    #resolve = (v) => {
        this.#resolvePromise(v)
    }
    
    #fulfil = (v) => {
        if (this.status === Pending) {
            this.status = Fulfilled
            this.value = v
            this.#triggerPromiseReactions()
        }
    }
    
    #reject = (reason) => {
        if (this.status === Pending) {
            this.status = Rejected
            this.value = reason
            this.#triggerPromiseReactions()
        }
    }
    
    
    then(onFulfilled, onRejected) {
        // 返回新promise
        const promise = new MyPromise(() => {})
        // 订阅onFulfilled和onRejected
        this.reaction.push({
            onFulfilled,
            onRejected,
            promise,
        })
        // 状态已确认,开始发布
        if (this.status !== Pending) {
            this.#triggerPromiseReactions()
        }
        return promise
    }
    
    #triggerPromiseReactions = () => {
        const reaction = this.reaction
        this.reaction = []
        const handlerKeyMap = {
            [Fulfilled]: 'onFulfilled',
            [Rejected]: 'onRejected',
        }
        const handlerKey = handlerKeyMap[this.status]
        // 根据status,取出对应订阅函数
        for (let {[handlerKey]: handler, promise} of reaction) {
            queueMicrotask(() => {
                if (typeof handler !== 'function') {
                    // then没有订阅函数 (eg: then(null,null)),
                    // 状态,值 直接传递
                    switch (this.status) {
                        case Fulfilled:
                            return promise.#resolve(this.value)
                        case Rejected:
                            return promise.#reject(this.value)
                    }
                } else {
                    // then有订阅函数 (eg: then(()=>1))),
                    try {
                        let result = handler(this.value)
                        return promise.#resolve(result)
                    } catch (e) {
                        return promise.#reject(e)
                    }
                }
            })
        }
    }
    
    // 处理 resolve中result的多种情况
    #resolvePromise = (result) => {
        // result是this
        if (this === result) {
            return this.#reject(new TypeError('The promise and the return value are the same'))
        }
        // 非object直接赋值.
        // 注意:function算object, null不算
        if (!isObject(result)) {
            return this.#fulfil(result);
        }
        let then;
        try {
            // 取 then
            then = result.then;
        } catch (error) {
            // 取 then 时抛出错误
            return this.#reject(error);
        }
        
        // 普通对象,非thenable对象
        if (typeof then !== 'function') {
            return this.#fulfil(result)
        }
        
        // result是myPromise或thenable
        // 统一在下一个微任务确认状态
        if (then === this.then) {
            // result 是原生      myPromise
            // this   是当前运行的 myPromise
            
            // 通过result.then,
            // 在result确认状态后,确认this的状态
            result.then(this.#fulfil, this.#reject)
        } else {
            // 是thenable（即带有"then" 方法的对象）
            // 去执行它, 在下一个微任务
            queueMicrotask(() => {
                const [resolve, reject] = callOnes(this.#resolve, this.#reject)
                try {
                    // this指向thenable
                    then.call(result, resolve, reject)
                } catch (error) {
                    reject(error)
                }
            })
        }
    }
}

// promise A+ test
module.exports = {
    deferred() {
        const result = {};
        result.promise = new MyPromise(function (resolve, reject) {
            result.resolve = resolve;
            result.reject = reject;
        });
        return result;
    },
    resolved(value) {
        return MyPromise.resolve(value)
    },
    rejected(reason) {
        return MyPromise.reject(reason)
    },
}

