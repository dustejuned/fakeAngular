var _ = require('lodash');

var Scope = require('../src/scope');

describe('Scope', function(){

    it('can be constructed and used as an object', function() {
        var scope = new Scope();
        scope.a = 1;
        expect(scope.a).toBe(1);
    });

});

describe('digest', function(){
    var scope;

    beforeEach(function(){
        scope = new Scope();
    });

    it('calls listner fuction on watch for digest', function(){
        var watchFn = function() {return 'I am a watch function';};
        var listerFn = jasmine.createSpy();

        scope.$watch(watchFn, listerFn);

        scope.$digest();

        expect(listerFn).toHaveBeenCalled();

    });

    it('calls listner function when watched value changes', function(){
        scope.someValue = 'my test';
        scope.counter = 0;

        scope.$watch(function(scope) {return scope.someValue;}, function(newValue, oldValue, scope){scope.counter++;});
        expect(scope.counter).toBe(0);

        scope.$digest();
        expect(scope.counter).toBe(1);

        scope.$digest();
        expect(scope.counter).toBe(1);

        scope.someValue = 'my new test';
        scope.$digest();
        expect(scope.counter).toBe(2);
    });
    it('calls listner with new value as old value the first time', function(){
        scope.someValue = 'my test';
        var oldeGivenValue;

        scope.$watch(function(scope) {return scope.someValue;}, function(newValue, oldValue, scope){oldeGivenValue = oldValue;});    
        scope.$digest();
        expect(oldeGivenValue).toBe('my test');

       
    });

    it('triggers chained watchers in same digest', function(){
        scope.name = 'Juned';

        scope.$watch(function(scope){
            return scope.nameUpper;
        }, function(newValue, oldValue, scope){
            if(newValue){
                scope.initial = newValue.substring(0, 1);
            }
        });

        scope.$watch(function(scope){
            return scope.name;
        }, function(newValue, oldValue, scope){
            if(newValue){
                scope.nameUpper = newValue.toUpperCase();
            }
        });

        scope.$digest();
        expect(scope.initial).toBe('J');

        scope.name = 'Duste';

        scope.$digest();
        expect(scope.initial).toBe('D');

    });

    it('give up on watches after 10 iterations', function(){
        scope.count1 = 0;
        scope.count2 = 0;

        scope.$watch(function(scope){
            return scope.count1;
        }, function(newValue, oldValue, scope){ 
            return scope.count2++;
        });

        scope.$watch(function(scope){
            return scope.count2;
        }, function(newValue, oldValue, scope){ 
            return scope.count1++;
        });


        expect((function(){ scope.$digest(); })).toThrow();
    });


    it('end the watch when last watch is clean', function(){
        scope.array = _.range(100);
        var watchCounter = 0;
        
        _.times(100, function(i){
            scope.$watch(function(scope){
                watchCounter++;
                return scope.array[i];
            }, function(newValue, oldValue, scope){                
            });
        });

       scope.$digest();

       expect(watchCounter).toBe(200);

       scope.array[0] = 924;

       scope.$digest();
       expect(watchCounter).toBe(301);
      
    });

    it('compares based on value enabled', function(){
        scope.aValue = [1, 2, 3];
        scope.counter = 0;

        scope.$watch(function(scope){return scope.aValue;}, function(newVal, oldVal, scope){scope.counter++;}, true);

        scope.$digest();
        expect(scope.counter).toBe(1);
        scope.aValue.push(4);
        scope.$digest();
        expect(scope.counter).toBe(2);

    });

    it('correctly handles NaN', function(){
        scope.number = 0/0; // NaN
        scope.counter = 0;

        scope.$watch(function(scope){return scope.number;}, function(newVal, oldVal, scope){scope.counter++;});
        
        scope.$digest();
        expect(scope.counter).toBe(1);

        scope.$digest();
        expect(scope.counter).toBe(1);

    });

    it('catches exception with watch function and continues', function(){        
        scope.aValue = 'aaa';
        scope.counter = 0;

        scope.$watch(function(scope){throw 'Exception';}, function(newVal, oldVal, scope){});
        scope.$watch(function(scope){return scope.aValue;}, function(newVal, oldVal, scope){scope.counter++;});
        scope.$digest();
        expect(scope.counter).toBe(1);      
    });

    it('catches exception with listen function and continues', function(){        
        scope.aValue = 'aaa';
        scope.counter = 0;

        scope.$watch(function(scope){return scope.aValue;}, function(newVal, oldVal, scope){throw 'Exception';});
        scope.$watch(function(scope){return scope.aValue;}, function(newVal, oldVal, scope){scope.counter++;});
        scope.$digest();
        expect(scope.counter).toBe(1);      
    });

    it('allows destroying of $watch with a removal function', function(){
        scope.aValue = 'aaa';
        scope.counter = 0;

        var destroyWatch = scope.$watch(function(scope){return scope.aValue;}, function(newVal, oldVal, scope){scope.counter++;});

        scope.$digest();
        expect(scope.counter).toBe(1);

        scope.aValue = 'abc';
        scope.$digest();
        expect(scope.counter).toBe(2);

        scope.aValue = 'xyz';
        destroyWatch();
        scope.$digest();
        expect(scope.counter).toBe(2);

    });

    it('allows destroying of $watch during digest', function() {
        scope.aValue = 'aaa';

        var watchCalls = [];

        scope.$watch(
            function(scope){
                watchCalls.push('first');
                return scope.aValue;
            }
        );

        var destroyWatch = scope.$watch(
            function(scope){
                watchCalls.push('second');
                destroyWatch();
            }
        );

        scope.$watch(
            function(scope){
                watchCalls.push('third');
                return scope.aValue;
            }
        );

        scope.$digest();

        expect(watchCalls).toEqual(['first', 'second', 'third', 'first', 'third']);

    });

    it('allow the watch to be destroyed by another during digest', function(){
        scope.aValue = 'aaa';
        scope.counter = 0;

        scope.$watch(function(scope){return scope.aValue;}, function(newVal, oldVal, scope){destroyWatch();});

        var destroyWatch = scope.$watch(function(scope){}, function(newVal, oldval, scope){});

        scope.$watch(function(scope){return scope.aValue;}, function(newVal, oldVal, scope){scope.counter++;});

        scope.$digest();

        expect(scope.counter).toBe(1);
    });

    it('allow destroying several watches during digest', function(){
        scope.aValue = 'aaa';
        scope.counter = 0;

        var destroyWatch1 = scope.$watch(function(scope){return scope.aValue;}, function(newVal, oldVal, scope){destroyWatch1(); destroyWatch2(); });

        var destroyWatch2 = scope.$watch(function(scope){}, function(newVal, oldval, scope){});      

        scope.$digest();

        expect(scope.counter).toBe(0);
    });
});

describe('$eval', function() {
    var scope;

    beforeEach(function(){
        scope = new Scope();
    });

    it('executes evaled function and return results',function(){
        scope.aValue = 1986;

        var result = scope.$eval(function(scope){return scope.aValue;});

        expect(result).toBe(1986);        
    });

    it('pass second argument to evaled function and return results',function(){
        scope.aValue = 1986;

        var result = scope.$eval(function(scope, arg){return scope.aValue + arg;}, 4);

        expect(result).toBe(1990);        
    });
});

describe('$apply', function() {
    var scope;

    beforeEach(function(){
        scope = new Scope();
    });

    it('execute given function and start digest',function(){
        scope.aValue = 1986;
        scope.counter = 0;
        scope.$watch(function(){return scope.aValue;}, function(){scope.counter++;});
        scope.$digest();

        scope.$apply(function(scope){
            scope.aValue = 1995;
        });

        expect(scope.counter).toBe(2);        
    });    
});

