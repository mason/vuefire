import {
  rtdbBindAsArray as bindAsArray,
  rtdbBindAsObject as bindAsObject,
  walkSet
} from '@posva/vuefire-core'

/**
 * Returns the original reference of a Firebase reference or query across SDK versions.
 *
 * @param {firebase.database.Reference|firebase.database.Query} refOrQuery
 * @return {firebase.database.Reference}
 */
export function getRef (refOrQuery) {
  // check if it is a query
  if (typeof refOrQuery.ref === 'object') {
    refOrQuery = refOrQuery.ref
  }

  return refOrQuery
}

const ops = {
  set: (target, key, value) => walkSet(target, key, value),
  add: (array, index, data) => array.splice(index, 0, data),
  remove: (array, index) => array.splice(index, 1)
}

function bind (vm, key, source) {
  return new Promise((resolve, reject) => {
    let unbind
    if (Array.isArray(vm[key])) {
      unbind = bindAsArray({
        vm,
        key,
        collection: source,
        resolve,
        reject,
        ops
      })
    } else {
      unbind = bindAsObject({
        vm,
        key,
        document: source,
        resolve,
        reject,
        ops
      })
    }
    vm._firebaseUnbinds[key] = unbind
  })
}

function unbind (vm, key) {
  vm._firebaseUnbinds[key]()
  delete vm._firebaseSources[key]
  delete vm._firebaseUnbinds[key]
}

/**
 * Ensure the related bookeeping variables on an instance.
 *
 * @param {Vue} vm
 */
function ensureRefs (vm) {
  if (!vm.$firebaseRefs) {
    vm.$firebaseRefs = Object.create(null)
    vm._firebaseSources = Object.create(null)
    vm._firebaseUnbinds = Object.create(null)
  }
}

export function rtdbPlugin (
  Vue,
  { bindName = '$rtdbBind', unbindName = '$rtdbUnbind' } = {}
) {
  const strategies = Vue.config.optionMergeStrategies
  strategies.firebase = strategies.provide

  Vue.mixin({
    created () {
      ensureRefs(this)
      let bindings = this.$options.firebase
      if (typeof bindings === 'function') bindings = bindings.call(this)
      if (!bindings) return

      for (const key in bindings) {
        this[bindName](key, bindings[key])
      }
    },

    beforeDestroy () {
      for (const key in this._firebaseUnbinds) {
        this._firebaseUnbinds[key]()
      }
      this._firebaseSources = null
      this._firebaseUnbinds = null
      this.$firebaseRefs = null
    }
  })

  Vue.prototype[bindName] = function rtdbBind (key, source) {
    if (this._firebaseUnbinds[key]) {
      this[unbindName](key)
    }

    const promise = bind(this, key, source)
    this._firebaseSources[key] = source
    this.$firebaseRefs[key] = getRef(source)

    return promise
  }

  Vue.prototype[unbindName] = function rtdbUnbind (key) {
    unbind(this, key)
  }
}
