var _ = require('lodash');

var ESCAPES = {'n': '\n', 'f': '\f', 'r': '\r', 't': '\t', 'v': '\v', '\'': '\'', '"' : '"'};

function Lexer(){
}

Lexer.prototype.lex = function(text){
    this.text = text;
    this.index = 0;
    this.ch = undefined;
    this.tokens = [];

    while(this.index < this.text.length){
        this.ch = this.text.charAt(this.index);
        if(this.isNumber(this.ch) || (this.ch === '.' && this.isNumber(this.peek()))){
            this.readNumber();
        } else if(this.is('\'"')){
            this.readString(this.ch);
        } else if(this.is('[],{}:.')){
            this.tokens.push({
                text: this.ch
            });
            this.index++;
        } else if(this.isIdentifier(this.ch)){
            this.readIdentifier();
        } else if(this.isWhiteSpace(this.ch)){
            this.index++;
        } else{
            throw 'Unexpected next character ' + this.ch;
        }
    }
    return this.tokens;
};

Lexer.prototype.is = function(chs){
    return chs.indexOf(this.ch) >= 0;
};

Lexer.prototype.isNumber = function(ch){
    return '0' <= ch && ch <= '9';
};

Lexer.prototype.readNumber = function(){
    var number = '';

    while(this.index < this.text.length){
        var ch = this.text.charAt(this.index).toLowerCase();
        if(this.isNumber(ch) || (ch === '.' && this.isNumber(this.peek()))){
            number += ch;            
        } else {
            var nextCh = this.peek();
            var prevCh = number.charAt(number.length - 1);
            if(ch === 'e' && this.isExpOperator(nextCh)){
                number += ch;
            } else if(this.isExpOperator(ch) && prevCh === 'e' && nextCh && this.isNumber(nextCh)){
                number += ch;
            } else if(this.isExpOperator(ch) && prevCh === 'e' && (!nextCh || !this.isNumber(nextCh))) {
                throw 'Invalid Exponent';
            } else{
                break;
            }            
        }
        this.index++;
    }
    this.tokens.push(
        {
            text: number,
            value: Number(number)
        }
    );
};

Lexer.prototype.readString = function(quote){
    this.index++;
    var string = '';
    var escape = false;
    while(this.index < this.text.length){
        var ch = this.text.charAt(this.index);
        if(escape){
            if(ch === 'u'){
                var hex = this.text.substring(this.index + 1, this.index + 5);
                if (!hex.match(/[\da-f]{4}/i)){
                    throw 'Invalid unicode escape';
                }
                this.index += 4;
                string += String.fromCharCode(parseInt(hex, 16));
            } else {
                var replacement = ESCAPES[ch];
                if(replacement){
                    string += replacement;
                } else {
                    string += ch;
                }
            }   
            escape = false;
        }else if(ch === quote){
            this.index++;
            this.tokens.push(
                {
                    text: string,
                    value: string
                }
            );
            return;
        } else if(ch === '\\'){
            escape = true;
        } else{
            string += ch;
        }
        this.index++;
    }

    throw 'Unmatched quote';
};

Lexer.prototype.readIdentifier = function(){
    var identifier = '';
    while (this.index < this.text.length){
        var ch = this.text.charAt(this.index);
        if(this.isIdentifier(ch) || this.isNumber(ch)){
            identifier += ch;
        } else {
            break;
        }
        this.index++;
    }
    var token = {text: identifier, identifier: true};
    this.tokens.push(token);
};

Lexer.prototype.peek = function(){
    if(this.index < this.text.length - 1){
        return this.text.charAt(this.index + 1);
    }

    return false;
};

Lexer.prototype.isExpOperator = function(ch){
    return ch === '-' || ch === '+' || this.isNumber(ch);
};

Lexer.prototype.isIdentifier = function(ch){
    return (ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z') || ch === '_' || ch === '$';
};

Lexer.prototype.isWhiteSpace = function(ch){
    return ch === ' ' || ch === '\r' || ch === '\t' ||
    ch === '\n' || ch === '\v' || ch === '\u00A0';
};

function AST(lexer){
    this.lexer = lexer;
}

AST.Program = 'Program';
AST.Literal = 'Literal';
AST.ArrayExpression = 'ArrayExpression';
AST.ObjectExpression = 'ObjectExpression';
AST.Property = 'Property';
AST.Identifier = 'Identifier';
AST.ThisExpression = 'ThisExpression';
AST.MemberExpression = 'MemberExpression';
AST.LocalsExpression = 'LocalsExpression';

AST.prototype.ast = function(text){
    this.tokens = this.lexer.lex(text);
    return this.program();
};

AST.prototype.program = function(){
    return {type: AST.Program, body: this.primary() };
};

AST.prototype.constants = {
    'null': {type: AST.Literal, value: null},
    'true': {type: AST.Literal, value: true},
    'false': {type: AST.Literal, value: false},
    'this': {type:AST.ThisExpression},
    '$locals': {type: AST.LocalsExpression}
};

AST.prototype.primary = function(){ 
    var primary;   
    if(this.expect('[')){        
        primary = this.arrayDeclaration();
    } else if(this.expect('{')){
        primary = this.object();
    } else if(this.constants.hasOwnProperty(this.tokens[0].text)){
        primary = this.constants[this.consume().text];
    } else if(this.peek().identifier){
        primary = this.identifier();
    } else{
        primary = this.constant();
    }
    var next;
    while((next = this.expect('.', '['))){
        if(next.text === '['){
           primary = {
            type: AST.MemberExpression,
            object: primary,
            property: this.primary(),
            computed: true
           }; 
           this.consume(']');
        }else{
            primary = {
                type: AST.MemberExpression,
                object: primary,
                property: this.identifier(),
                computed: false
            };
        }
    }

    return primary;
};

AST.prototype.object = function(){
    var properties = [];
    if(!this.peek('}')){
        do {
            var property = {type: AST.Property};
            if(this.peek().identifier){
                property.key = this.identifier();
            } else{
                property.key = this.constant();
            }
            this.consume(':');
            property.value = this.primary();
            properties.push(property);
        } while(this.expect(','));
    }
    this.consume('}');
    return {type:AST.ObjectExpression, properties: properties};
};

AST.prototype.identifier = function() {
    return {type: AST.Identifier, name: this.consume().text};
};

AST.prototype.arrayDeclaration = function(){
    var elements = [];
    if(!this.peek(']')){
        do{
            if(this.peek(']')){
                break;
            }
            elements.push(this.primary());            
        } while(this.expect(','));
    }
    this.consume(']');
    return {type: AST.ArrayExpression, elements: elements};
};

AST.prototype.expect = function(ch1, ch2, ch3, ch4){
   var token = this.peek(ch1, ch2, ch3, ch4);
   if(token){
        return this.tokens.shift();
   }   
};

AST.prototype.peek = function(ch1, ch2, ch3, ch4){
    if(this.tokens.length > 0){
        var text = this.tokens[0].text;
        if(text === ch1 || text === ch2 || text === ch3 || text === ch4 || (!ch1 && !ch2 && !ch3 && !ch4)){
            return this.tokens[0];
        }
    }
};

AST.prototype.consume = function(ch){
    var token = this.expect(ch);
    if(!token){
        throw 'Unexpected. Expecting: ' + ch;
    }

    return token;
};

AST.prototype.constant = function(){
    return {type: AST.Literal, value: this.consume().value};
};

function ASTCompiler(astBuilder){
    this.astBuilder = astBuilder;
}

ASTCompiler.prototype.compile = function(text){
    var ast = this.astBuilder.ast(text);    
    this.state = {body: [], nextId: 0, vars: []};
    this.recurse(ast); 
    // var code = (this.state.vars.length ? 'var ' + this.state.vars.join(',') + ';': '') + this.state.body.join('');
    
    // console.log(code);
    
    /* jshint -W054 */ 
    return new Function('s', 'l', (this.state.vars.length ? 'var ' + this.state.vars.join(',') + ';': '') + this.state.body.join('')); 
    /* jshint +W054 */
};

ASTCompiler.prototype.recurse = function(ast){
    var newId;
    switch(ast.type){
        case AST.Program:
            this.state.body.push('return ', this.recurse(ast.body), ';');            
            break;
        case AST.Literal:            
            return this.escape(ast.value);
        case AST.ArrayExpression:
            var elements = _.map(ast.elements, _.bind(function(element){ return this.recurse(element);}, this));            
            return '[' + elements.join(',') +']';
        case AST.ObjectExpression:
            var properties = _.map(ast.properties, _.bind(function(property){
                var key = property.key.type === AST.Identifier ? property.key.name : this.escape(property.key.value);
                var value = this.recurse(property.value);
                return key + ':' + value;
            }, this));
            return '{' + properties.join(',') +'}';
        case AST.Identifier:
            newId = this.nextId();
            this.if_(this.getHasOwnProperty('l', ast.name), this.assign(newId, this.nonComputedMember('l', ast.name)));
            this.if_(this.not(this.getHasOwnProperty('l', ast.name)) + ' && s', this.assign(newId, this.nonComputedMember('s', ast.name)));
            return newId;
        case AST.ThisExpression:
            return 's';
        case AST.MemberExpression:
            newId = this.nextId();
            var left = this.recurse(ast.object);
            if(ast.computed){
                var right = this.recurse(ast.property);
                this.if_(left, this.assign(newId, this.computedMember(left, right)));
            } else{
                this.if_(left, this.assign(newId, this.nonComputedMember(left, ast.property.name)));
            }
            return newId;
        case AST.LocalsExpression:
            return 'l';
    }
};

ASTCompiler.prototype.computedMember = function(left, right){
    return '(' + left + ')[' + right + ']';
};

ASTCompiler.prototype.nonComputedMember = function(left, right){
    return '(' + left + ').' + right;
};

ASTCompiler.prototype.not = function(e){
    return '!(' + e + ')';
};

ASTCompiler.prototype.getHasOwnProperty = function(obj, prop){
    return obj + '&&(' + this.escape(prop) + ' in ' + obj + ')';
};

ASTCompiler.prototype.if_ = function(test, consequent){
    this.state.body.push('if(', test, '){', consequent, '}');
};

ASTCompiler.prototype.assign = function(id, value){
    return id + '=' + value + ';';
};

ASTCompiler.prototype.nextId = function(){
    var id = 'v' + (this.state.nextId++);
    this.state.vars.push(id);
    return id;
};

ASTCompiler.prototype.escape = function(value){
    if(_.isString(value)){
        return '\'' + value.replace(this.stringEscapeRegex, this.stringEscapeFn) + '\'';
    } else if(_.isNull(value)){
        return 'null';
    }
    return value;
};

ASTCompiler.prototype.stringEscapeRegex = /[^ a-zA-Z0-9]/g;

ASTCompiler.prototype.stringEscapeFn = function(c) {
    return '\\u' + ('0000' + c.charCodeAt(0).toString(16)).slice(-4);
};

function Parser(lexer){
    this.lexer = lexer;
    this.ast = new AST(lexer);
    this.compiler = new ASTCompiler(this.ast);
}

Parser.prototype.parse = function(text){    
    return this.compiler.compile(text);
};

function parse(expr){    
    //Parse here
    var lexer = new Lexer();
    var parser = new Parser(lexer);
    return parser.parse(expr);
}


module.exports = parse;