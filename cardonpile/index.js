/*global $*/
import autoBind from "./autobind.js";
let suits = {"H":"&hearts;",
             "D":"&diams;",
             "S":"&spades;",
             "C":"&clubs;"};
let colors = {"H": "red",
              "D": "orange",
              "S": "black",
              "C": "blue"};
let values = ["A","2","3","4","5","6","7","8","9","10","J","Q","K"];
function randint(start,eww) {//a number start, start+1, ..., eww-1
    if (eww==undefined) {
        eww = start;
        start=0;
    }
    return Math.floor((eww-start)*Math.random())+start;
}
let sources = [];
let targets = [];
let piles = [];
let foundation = {};
let docks = []; //was braidTargets
//----------------------------------------
let Undo = new class {
    constructor() {
        this.stack = [];
        this.rstack = [];
        autoBind(this);
    }
    add(source,target) {
        //dir is the direction of the foundation: -1,0,1
        this.stack.push([source,target]);
    }
    undo() {
        if (this.stack.length==0) {return;}
        let [source,target] = this.stack.pop();
        if (target=="flip") {
            source.unflip();
        } else {
            source.add(target.remove());
            SetDirection(); //a function which looks at the foundations and figures out dir
        }
        this.rstack.push([source,target]);
    }
    redo() {
        if (this.rstack.length==0) {return;}
        let [source,target] = this.rstack.pop();
        if (target=="flip") {
            source.flip();
        } else {
            target.add(source.remove());
        }
        this.stack.push([source,target]);
        SetDirection();
    }
}
//----------------------------------------
let selection = new class {
    constructor() {
        this.$root = $("body");
        this.clear();
        this.shift = {x: -20, y: -20};
        autoBind(this);
    }
    unhighlight() {
        $(".pile.highlight").removeClass("highlight");
    }
    clear() {
        this.card = null; //card that is currently being dragged
        this.moved = false; //whether the mouse has moved or not
        this.source = null; //the pile the card came from
        this.target = null; //the pile that is currently being targeted
        this.unhighlight();
    }
    reject() {
        if (this.card==null) {return;}
        this.source.add(this.card);
        this.clear();
    }
    dragstart(pile,e) {
        this.unhighlight();
        this.card = pile.remove();
        this.card.$w.addClass("dragging");
        this.card.$w.detach();
        this.card.$w.appendTo(this.$root);
        this.source = pile;
    }
    dragmove(e,buttondown) {
        this.moved = true;
        let ct = e.changedTouches;
        let co;
        if (ct) {
            co = {x:ct[0].pageX, y: ct[0].pageY};
        } else {
            co = {x:e.pageX, y:e.pageY};
        }
        
        if (buttondown && this.card) {
            this.card.move(co.x + this.shift.x,
                           co.y + this.shift.y);
        }
    }
    dragend(e) {
        if (!this.card) {return;}
        this.card.$w.removeClass("dragging");
        if(!this.moved) {//just a click
            if (!AutoMoveToFoundation(this.source, this.card)) {
                this.source.add(this.card);
            }
        } else if (this.target && this.target.ok(this.card)) {
            this.target.add(this.card);
            Undo.add(this.source, this.target);
        } else {
            this.reject();
        }
        this.clear();
        e.preventDefault();
        SetDirection();
    }
    hover(pile) {
        this.target = pile;
        pile.hoverIn();
    }
    unhover(pile) {
        if(this.card) {this.moved = true;}
        this.target = null;
        pile.hoverOut();
    }
}
//----------------------------------------
class Card {
    constructor(suit,value) {
        this.suit = suit;
        this.value = value;
        this.$w = $("<div>")
            .addClass("card")
            .addClass("card"+this.str())
            .html(value+suits[suit])
            .css({"color":colors[this.suit]});
        autoBind(this);
    }
    move(x,y) {
        this.$w.css({top: y, left:x });
        this.x = x; this.y = y;
    }
    setZ(z) {//might be useful?
        this.$w.css("z-index",z);
    }
    str() {
        return this.value + this.suit;
    }
    //removed move command, handle this from selection
}
function makedeck() {
    let cards = [];
    for (let n=1; n<=2; n++) {
        for (let suit of "DHCS") {
            for (let val of values) {
                let pos = randint(0,cards.length+1);
                cards.splice(pos,0,new Card(suit,val));
            }
        }
    }
    return cards;
}

class Pile {
    constructor($root,cls) {
        this.label = piles.length;
        this.$root = $root;
        this.z = 100;
        this.$w = $("<div>")
            .addClass("pile")
            .addClass(cls)
            .appendTo($root);
        this.$o = $("<div>")
            .addClass("overlay")
            .appendTo(this.$w);
        this.stack = [];
        piles.push(this);
        autoBind(this);
    }
    ok(card) {//extensible
        return false;
    }
    hoverIn(e){//extensible
    }
    hoverOut(e){//extensible
    }
    //removed pos, hoping I can dodge it
    add(card) {
        this.stack.push(card);
        let n = this.stack.length;
        card.setZ(this.z + n);
        card.pile = this;
        card.$w.detach();
        card.$w.appendTo(this.$w);
        card.$w.css({top: 0, left: 0});
    }
    remove() {
        let card = this.stack.pop();
        return card;
    }
    top() {
        if (this.empty()) {return null;}
        return this.stack[this.stack.length-1];
    }
    empty() {
        return this.stack.length==0;
    }
}
//----------------------------------------
class Talon extends Pile {
    constructor($root,discard,cards) {
        super($root,"talon");
        for(let card of cards) {
            this.add(card);
        }
        this.$o.on("click",this.flip);
        this.times=1; //for use later
        this.target = discard;
        autoBind(this);
    }
    update() {
        this.$o.html(this.stack.length);
    }
    add(card) {
        super.add(card);
        this.update();
    }
    remove() {
        let card = super.remove();
        this.update();
        return card;
    }
    flip() {
        selection.unhighlight();
        if (this.empty()) {
            while (!this.target.empty()) {
                this.add(this.target.remove());
            }
            this.times++;
            Undo.add("flip");
        } else {
            Undo.add(this,this.target);
            this.target.add(this.remove());
        }
        this.$o.toggleClass("empty",this.empty());
    }
    unflip() {
        while(!this.empty()) {
            this.target.add(this.remove());
        }
        this.$o.toggleClass("empty",this.empty());
    }
}
//----------------------------------------
class Braid extends Pile {
    constructor($root) {
        super($root,"braid");
        this.$o.remove();
    }
    contains(card) {
        for (let i of this.stack) {
            if (card.value == i.value && card.suit == i.suit) {return true;}
        }
        return false;
    }
    pos(i) {
        let x,y;
        let Xmax = 4.0;
        let Ymax = 5.0;
        let s = 0.04;
        if (i==0)       {x = 0;              y = 4;}
        else if (i<=3)  {x = 0.5 +  s*(i-2); y = 4-i;}
        else if (i==4)  {x = 1;              y = 0;}
        else if (i<=8)  {x = 1.5 + s*(i-6);  y = i-4;}
        else if (i==9)  {x = 2;              y = 5;}
        else if (i<=13) {x = 2.5 + s*(i-11); y = 14-i;}
        else if (i==14) {x = 3;              y = 0;}
        else            {x = 3.5 + s*(i-17); y = i-14;}
        console.log(i,x,y);
        return [x/Xmax, y/Ymax];
    }
    add(card) {
        if (!card) {return;}
        let [x,y] = this.pos(this.stack.length);
        console.log(x,y);
        super.add(card);
        card.$w.css({top: `${y*65}%`, left: `${x*85}%`});
    }
    
}
//----------------------------------------
class DragOut extends Pile {
    constructor($root,cls) {
        super($root,cls);
        if (!(this instanceof Foundation)) {
            sources.push(this);
        }
        this.$o.on("click", (e,pile=this)=> {
            if (AutoMoveToFoundation(pile,pile.top())) {
                pile.remove();
            }
        });
        this.$o.on("mousemove",(e,pile=this)=>{
            if (e.buttons && !selection.card) {selection.dragstart(pile,e);}
        });
        this.$o.on("touchstart", (e,pile=this)=>{
            selection.dragstart(pile,e);
            e.preventDefault();
        });
    }
    highlight() {
        this.$w.addClass("highlight");
    }
}
//----------------------------------------
function GetAvailable(braid) {
}
//----------------------------------------
class Discard extends DragOut {
    constructor($root) {
        super($root,"discard");
    }
}
//----------------------------------------
class DragIn extends DragOut {
    constructor($root,cls) {
        super($root,cls);
        targets.push(this);
        this.$w.on("mouseenter",(e,pile=this)=>{selection.hover(pile);});
        this.$w.on("mouseleave",(e,pile=this)=>{selection.unhover(pile);});
        autoBind(this);
    }
    ok(card) {
        return this.empty();
    }
    hoverIn() {
        if (selection.card) {
            this.$w.addClass("hover");
        }
    }
    hoverOut() {
        this.$w.removeClass("hover");
    }
}
//----------------------------------------
class Free extends DragIn {
    constructor($root) {
        super($root,"free");
    }
    ok (card) {
        return (super.ok(card) && !(selection.source instanceof Dock));
    }
}
//----------------------------------------
function RunDocks() {
    for (let i of docks) {
        docks.flow();
    }
}
//----------------------------------------
class Dock extends DragIn {
    constructor($root,braid) {
        super($root,"dock");
        this.braid = braid;
    }
    add(card) {
        super.add(card);
        this.flow();
    }
    remove() {
        let card = super.remove();
        this.flow();
        return card;
    }
    flow() {//flow from braid to docks
        if (this.empty()) {
            let card = this.braid.remove();
            if (card) {
                this.add(card);
            }
        }
        if (this.stack.length==2) {
            this.braid.add(this.stack.shift());
        }
    }
}
function AutoMoveToFoundation(pile,card) {
    let move = false;
    if (card) {
        for (let key of foundation.keys) {
            let target = foundation[key];
            if (target.ok(card,true)) {
                Undo.add(pile,target);
                target.ok(card);
                target.add(card);
                return true;
            }
        }
    }
    return false;
}
function Compare(a,b) {
    if (!a || !b) {return 0;}
    if (!(typeof(a)=="number")) {a=a.value;}
    if (!(typeof(b)=="number")) {b=b.value;}
    let N = values.length;
    if (a==b) {return 0;}
    let V = a - b;
    if ((V+N-1)%N == 0) {return 1;}
    if ((V+N+1)%N == 0) {return -1;}
    return 0;
}
function GetDirection() {
    for (let key of foundation.keys) {
        let dir = foundation[key].getDir();
        if (dir!=0) {return dir;}
    }
    return 0;
}
function SetDirection() {
    let dir = GetDirection();
    foundation.direction = dir;
    foundation.$arrow
        .toggleClass("up",dir>0)
        .toggleClass("down",dir<0);
}
//----------------------------------------
class Foundation extends DragIn {
    constructor($root,suit,start) {
        super($root,"foundation");
        this.$w.html(start+suits[suit]);
        this.suit = suit;
        this.start = start;
        this.$o.on("mousedown",this.highlightNext);
        this.$o.appendTo(this.$w);
    }
    highlightNext() {
        for (let pile of sources) {
            if (this.ok(pile.top(), true)) {
                pile.highlight();
            }
        }
    }
    getDir() {
        return Compare(this.stack[0],this.stack[1]);
    }
    ok(card) {
        console.log("ok for ",this.suit,this.start);
        if (!card) {return false;}
        console.log(card);
        if (card.suit != this.suit) {return false;}
        console.log("suits match");
        if (this.stack.length==0) {
            return card.value == this.start;
        }
        let dir = Compare(values.indexOf(this.top().value), values.indexOf(card.value));
        console.log(this.top().value,card.value,values.indexOf(this.top().value),values.indexOf(card.value),dir);
        if (dir==0) {return false;}
        if (dir * foundation.direction == 1) {return true;}
        if (foundation.direction == 0) {
            return true;
        }
        return false;
    }
}
function init() {
    let $root = $("#canvas");
    $root.on("mouseup", selection.dragend);
    $root.on("touchend", selection.dragend);
    $root.on("mousemove",(e)=>{selection.dragmove(e,e.buttons)});
    $root.on("touchmove",(e)=>{selection.dragmove(e,true);});
    let cards = makedeck();
    //Do braid here
    let braid = new Braid($("#braid"));
    for (let i=0; i<20; i++) {
        braid.add(cards.pop());
    }
    //dock
    for (let i=0; i<=3; i++) {
        let pile = new Dock($("#dock"),"dock",braid);
        docks.push(pile);
        pile.add(cards.pop());
    }
    let free = [];
    for(let i = 0; i<8; i++) {
        let pile = new Free($("#free"),"free");
        free.push(pile);
        if (i) {pile.add(cards.pop());}
    }
    //foundation
    
    foundation.direction = 0;
    foundation.keys = [];
    foundation.$arrow = $("#direction");
    let card = cards.pop();
    foundation.value = card.value;
    for (let suit of Object.keys(suits)) {
        for (let col of [0,1]) {
            let key = suit+col;
            foundation[key] = new Foundation($("#foundations"), suit, foundation.value);
            if (col==0 && suit==card.suit) {
                foundation[key].add(card);
            }
            foundation.keys.push(key);
        }
    }

    //DISCARD PILE----------------------------------------
    let $talon = $("#talonbox");
    let discard = new Discard($talon);
    let talon = new Talon($talon, discard, cards);
    
    
}
$(init)
