const Pending = 'Pending'
const Fulfilled = 'Fulfilled'
const Rejected = 'Rejected'

//
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
        const promise = new MyPromise(() => {})
        this.reaction.push({
            onFulfilled,
            onRejected,
            promise,
        })
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
        for (let {[handlerKey]: handler, promise} of reaction) {
            //PromiseReactionJob
            queueMicrotask(() => {
                // if (typeof handler !== 'function') {
                //     // then没有处理函数 (eg: then(null,null))
                //     // 值直接传递
                //     switch (this.status) {
                //         case Fulfilled:
                //             handler = v => v
                //             break
                //         case Rejected:
                //             handler = v => v
                //             break
                //     }
                // }
                
                if (typeof handler !== 'function') {
                    // then没有处理函数 (eg: then(null,null)),
                    // 值直接传递
                    switch (this.status) {
                        case Fulfilled:
                            return promise.#resolve(this.value)
                        case Rejected:
                            return promise.#reject(this.value)
                    }
                } else {
                    // then有处理函数 (eg: then(()=>1))),
                    // 执行处理函数
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
    
    
    #resolvePromise = (result) => {
        if (this === result) {
            return this.#reject(new TypeError('The promise and the return value are the same'))
        }
        const isObject = v => v !== null && typeof v === 'object' || typeof v === 'function'
        
        if (!isObject(result)) {
            return this.#fulfil(result);
        }
        let then;
        try {
            // 把 result.then 赋值给 then
            then = result.then;
            
        } catch (error) {
            // 如果取 result.then 的值时抛出错误 e ，则以 e 为据因拒绝 promise
            return this.#reject(error);
        }
        // 非 thenable
        if (typeof then !== 'function') {
            return this.#fulfil(result)
        }
        // result是myPromise或thenable
        try {
            if (then === this.then) {
                // 是原生myPromise
                result.then(this.#fulfil, this.#reject)
            } else {
                // 是thenable
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
        } catch (error) {
            this.#reject(error);
        }
    }
    
}

let o = {
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
module.exports = o

