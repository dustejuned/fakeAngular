var sayHello = require('../src/hello');

describe('hello', function(){
    it('says hello', function(){
        var to = 'Juned';
        expect(sayHello(to)).toBe("Hello, Juned!");
    });
});