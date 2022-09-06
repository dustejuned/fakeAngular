var _ = require('lodash');

function Scope(){
    this.$$watchers = [];
    this.$$lastDirtyWatch = null;
}

function initialWatchVal(){}

Scope.prototype.$watch = function($watchFn, $listenerFn, valueEq){
    var self = this;
    var watcher = {
        watchFn: $watchFn,
        listenerFn: $listenerFn || function() {},
        valueEq: !!valueEq,
        last:initialWatchVal
    };

    self.$$watchers.unshift(watcher);
    self.$$lastDirtyWatch = null;

    return function(){
        var index = self.$$watchers.indexOf(watcher);
        if(index >= 0){
            self.$$watchers.splice(index, 1);
            self.$$lastDirtyWatch = null;
        }
    };
};

Scope.prototype.$$digestOnce = function(){
    var self = this;
    var newVal, oldVal, isDirty;
    _.forEachRight(this.$$watchers, function(watcher){
        try{
            if(watcher){
                newVal = watcher.watchFn(self);
                oldVal = watcher.last;        
                if(!self.$$areEqual(newVal, oldVal, watcher.valueEq)){
                    self.$$lastDirtyWatch = watcher;
                    watcher.last = watcher.valueEq ? _.cloneDeep(newVal) : newVal;
                    watcher.listenerFn(newVal, oldVal === initialWatchVal ? newVal : oldVal, self);
                    isDirty = true;
                } else if(self.$$lastDirtyWatch === watcher){
                    return false;
                }
            }           
        }catch(e){
            console.log(e);
        }       
    });

    return isDirty;
};

Scope.prototype.$$areEqual = function(newVal, oldVal, valueEq){
    if(valueEq){
        return _.isEqual(oldVal, newVal);
    } else{
        return oldVal === newVal || (typeof newVal === 'number' && typeof oldVal === 'number' && isNaN(newVal) && isNaN(oldVal));
    }    
};

Scope.prototype.$digest = function(){
    var ttl = 10;
    var isDirty;
    this.$$lastDirtyWatch = null;

   do{
        isDirty = this.$$digestOnce();
        if(isDirty && !(ttl--)){
            throw 'Reached 10 digest iterations';
        }
   } while(isDirty);
};

Scope.prototype.$eval = function(expr, args){
    return expr(this, args);
};

Scope.prototype.$apply = function(expr){
    try{
        return this.$eval(expr);
    }finally{
        this.$digest();
    }
    
};

module.exports = Scope;