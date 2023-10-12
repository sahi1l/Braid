import autoBind from "./autobind.js";
let foundation = {};
let cardwidth;
let cardheight;
let left;
let top;
let freetop;
let foundleft;
let positions = {};

let docks = [];
let Z = {
    "canvas": 0,
    "cards": 100,
};
let suits = {"H":"&hearts;",
             "D":"&diams;",
             "S":"&spades;",
             "C":"&clubs;"};
let colors = {"H": "red",
              "D": "orange",
              "S": "black",
              "C": "blue"};
let values = ["A","2","3","4","5","6","7","8","9","10","J","Q","K"];
let sources = [];
let targets = [];
let piles = [];
let mycards = [];
function randint(start,eww) {//a number start, start+1, ..., eww-1
    if (eww==undefined) {
        eww = start;
        start=0;
    }
    return Math.floor((eww-start)*Math.random())+start;
}
//------------------------------------------------------------
let Undo = new class {
    constructor() {
        this.stack = [];
        this.rstack = [];
        this.add=this.add.bind(this);
        this.undo = this.undo.bind(this);
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
            SetDirection();
        }
        this.rstack.push([source,target]);
    }
    redo() {
        if (this.rstack.length==0) {return;}
        let [source,target] = this.rstack.pop();
        if (target == "flip") {
            source.flip();
        } else {
            target.add(source.remove());
        }
        this.stack.push([source,target]);
        SetDirection();
    }
}
//------------------------------------------------------------

let selection = new class {
    constructor() {
        this.$root = $("body");
        this.clear();
        this.shift = {x:-positions.shift,y:-positions.shift};
        autoBind(this);
    }
    clear() {
        this.card= null; //the card that is currently being dragged
        this.moved= false; //whether the mouse has moved or not
        this.source= null; //the pile that the card came from
        this.target= null; //the pile that is currently being targeted
        this.unhighlight();
    }
    unhighlight() {
        $(".pile.highlight").removeClass("highlight");
    }
    reject() {//replaces card.returntopile
        if (this.card==null) {return;}
        this.source.add(this.card);
        this.clear();
    }
    dragstart(pile,e) {
        this.unhighlight();
        this.card = pile.remove();
        this.card.$w.addClass("dragging");
        this.source = pile;
        
    }
    dragend(e) {
        if(!this.card) {return;}
        this.card.$w.removeClass("dragging");
        if(!this.moved) {
            if (! AutoMoveToFoundation(this.source,this.card)) {
                this.source.add(this.card);
            }
        } else if (this.target && this.target.ok(this.card)) {
            this.target.add(this.card);
            Undo.add(this.source,this.target);
        } else {
            this.reject();
        }
        this.clear();
        SetDirection();
        e.preventDefault();
    }
    dragmove(e,buttondown) {
        this.moved = true;
        let co = GetCoords(e);
        if (buttondown && this.card) {
            this.card.move(co.x + this.shift.x,
                           co.y + this.shift.y);
        }
        this.target = null;
        for (let p of targets) {
            if (p.insideQ(co.x,co.y)) {
                this.target = p;
                p.hoverIn();
            } else {
                p.hoverOut();
            }
        }
    }
};

function GetCoords(e) {
    let ct = e.changedTouches;
    if (ct) {
        return {x:ct[0].pageX,y:ct[0].pageY};
    } else {
        return {x:e.pageX, y:e.pageY};
    }
}
//let selected = null;
//let dragged = false;
//let activepile = null;

function coords(x,y) {
    //convert from points to vw/vh
    let canvas = $("#canvas")[0].getBoundingClientRect();
    return {left: (x/canvas.width*100)+"vw",
            top:  (y/canvas.height*100)+"vh"};
}
function adjustPositions() {
    for (let card of mycards) {
        if (!(card.pile instanceof Braid)) {
            card.adjustPosition();
        }
    }
    console.debug("adjusting");
}

class Card {
    constructor($root,suit,value) {
        this.$root = $root;
        this.suit = suit;
        this.value = value;
        this.$w = $("<div>")
            .addClass("card")
            .addClass(`card${value}${suit}`)
            .html(value+suits[suit])
            .css({"color":colors[this.suit],
                 // "width": cardwidth,
                 // "height": cardheight
                 });
        this.x=-100; this.y=-100;
        this.move(-100,-100);
        //QUESTION: 
        this.$w.appendTo(this.$root);
        autoBind(this);

    }
    adjustPosition() {
        if (this.pile) {
            let R = this.pile.pos();
            this.$w.css(coords(R[0],R[1]));
        }
    }
    move(x,y) {
        this.$w.css(
            coords(x,y)
        );
        this.x = x; this.y = y;
    }
    str() {
        return this.value + this.suit;
    }
}
function makedeck($root) {
    let cards = [];
    for (let n = 1; n<=2; n++) {
        for (let suit of "DHCS") {
            for (let val of values) {
                let pos = randint(0,cards.length+1); //because you can insert cards at the end too
                cards.splice(pos, 0, new Card($root,suit,val)); //inserts randomly
            }
        }
    }
    //last card always seems to be the same, bleh
//    let card1 = cards.splice(-1,1)[0];
//    let pos = randint(0,cards.length);
    //    cards.splice(pos,0,card1);
    mycards = [...cards];
    return cards;
}
class Pile {
    constructor($root,x,y,createQ=true) {
        this.x = x;
        this.y = y;
        this.label = piles.length;
        this.$root = $root;
        if(createQ) {
            this.$w = $("<div>").addClass("pile")
                .css({top: y, left: x}).appendTo($root);
        } else {
            this.$w = this.$root;
        }
        this.$w.addClass("pile");
        this.$overlay = $("<div>")
            .addClass("overlay")
            .appendTo(this.$w);
        //this.$overlay.on("mouseenter", (e)=>console.log("Entering ",this.label));
        //this.$overlay.on("mouseleave", (e)=>console.log("Leaving ",this.label));
        this.stack = [];
        piles.push(this);
        autoBind(this);
    }
    insideQ(x,y) {
        let R = this.$w[0].getBoundingClientRect();
        return (x>=R.left && x<=R.right && y>=R.top && y<=R.bottom);
    }
    ok(card) {
        return false; //extensible
        //return this.stack.length==0;
    }
    hoverIn(e) {
        //this.$w.addClass("hover"); //extensible
    }
    hoverOut(e) {
        //this.$w.removeClass("hover"); //extensible
    }
    pos(i) {
        //position of the ith card in the pile, extensible for Braid
        let R = this.$w[0].getBoundingClientRect();
        let margin = parseFloat($(this.$w[0]).css("margin-left"));
        console.debug($(this.$w[0]).css("margin-left"));
        return [R.left-margin,R.top-margin];
    }

    add(card) {
        this.stack.push(card);
        let n = this.stack.length;
        card.$w.css({"z-index":Z.cards + n});
        card.pile = this;
        card.move(...this.pos(n));
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
class Talon extends Pile {
    constructor($root,x,y,target,cards) {
        super($root,x,y);
        this.$w.addClass("talon");
        for(let card of cards) {
            this.add(card);
        }
        this.$overlay.on("click",this.flip);
        this.times=1;
        this.target = target;
        autoBind(this);
    }
    update() {
        this.$overlay.html(this.stack.length);
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
        if (this.empty()){
            while (!this.target.empty()){
                this.add(this.target.remove());
            }
            this.times++;
        } else {
            Undo.add(this,this.target);
            this.target.add(this.remove());
        }
        this.$overlay.toggleClass("empty",this.empty());
    }
}
class Braid extends Pile {
    constructor($root,x,y){
        super($root,x,y,false);
        this.$w.addClass("braid");
        this.$overlay.remove();
        this.x = 10;
        this.y = 10;
    }
    contains(card) {
        for(let i of this.stack) {
            if (card.value == i.value && card.suit == i.suit) {return true;}
        }
        return false;
    }
    pos(i) {
        //this is an arc down and to the left
        if (false) {
            this.x = 220;
            this.y = 300;
            let dx = this.x;
            let dy = cardheight*20*0.8;
            let p = (19-i)/20.0;
            let yi = this.y - p * dy;
            let xi = this.x - dx * Math.sqrt(1-p**2);
            return [xi,yi];
        }
        if (true) {
            let x,y;
            if (i===0) {x=-0.5;y=4;}
            else if (i<=3) {x=0+0.04*(i-2)  ;y=4-i;}
            else if (i==4) {x=0.5; y=0;}
            else if (i<=8) {x=1 + 0.04*(i-6); y=i-4;}
            else if (i==9) {x=1.5; y=5;}
            else if (i<=13) {x=2 + 0.04*(i-11); y=14-i;}
            else if (i==14) {x=2.5; y=0;}
            else {x=3+0.04*(i-17); y=i-14;}
            return [this.x + x * cardwidth*1.5,
                    this.y + y * cardheight*0.9]
        }
        return [];
    };
}
class DragOut extends Pile {
    constructor($root,x,y) {
        super($root,x,y);
        if (!(this instanceof Foundation)) {
            sources.push(this);
        }
        this.$overlay.on("click",(e,pile=this)=>{
            if (AutoMoveToFoundation(pile,pile.top())) {
                pile.remove();
                SetDirection();
            }
        });
        this.$overlay.on("mousemove",(e,pile=this)=>{
            if(e.buttons && !selection.card) {selection.dragstart(pile,e);}
        });
        this.$overlay.on("touchstart",(e,pile=this)=>{
            selection.dragstart(pile,e);
            e.preventDefault();
        });
    }
    highlight() {
        this.$w.addClass("highlight");
    }
}
function GetAvailable(braid) {
    /*
      For each available card, determine whether it could be placed on the foundation.
      If the card is a root card, move it.
      If the direction has not been determined, highlight but do not move.
      If the available card does not exist in the braid, go ahead and move it.
      Otherwise highlight it somehow.
    */
    let movedFlag = false;
    for (let pile of sources) {
        let card = pile.top();
        if(card) {
            for(let key of foundation.keys) {
                let label = card.str()+"->"+key;
                let target = foundation[key];
                if (target.ok(card,true)) {//this card could be placed on the thingy
                    let move = false;
                    if(card.value == foundation.value) {
                        move=true;
                    }
                    else if (foundation.direction) {
                        if (!(braid.contains(card))) {
                            move=true;
                        }
                    }
                    if(move) {
                        Undo.add(pile,target);
                        target.add(card);
                        pile.remove();
                        movedFlag = true;
                    } else {pile.highlight();}
                    break;
                }
            }
        }
    }
    if(movedFlag) {GetAvailable(braid);}
}
class Discard extends DragOut {
    constructor($root,x,y) {
        super($root,x,y);
        //not sure if there's anything to add
    }

}
class DragIn extends DragOut {
    constructor($root,x,y) {
        super($root,x,y);
        targets.push(this);
        autoBind(this);
    }
    ok(card) {
        return this.empty();
    }
    hoverIn() {
        if(selection.card) {
            this.$w.addClass("hover");
        }
    }
    hoverOut() {
        this.$w.removeClass("hover");
    }
}
class Free extends DragIn {
    constructor($root,x,y) {
        super($root,x,y);
    }
    ok (card) {
        return (super.ok(card) && !(selection.source instanceof Dock));
    }

}
class Dock extends DragIn {
    constructor($root,x,y,braid) {
        super($root,x,y);
        this.braid = braid;
    }
    add(card) {
        super.add(card);
        this.callback();
    }
    remove() {
        let card = super.remove();
        this.callback();
        return card;
    }
    callback() {
        if(this.empty()) {
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
    foundation.direction = 0;

function AutoMoveToFoundation(pile,card) {
    let move = false;
    if(card) {
        for(let key of foundation.keys) {
            let label = card.str()+"->"+key;
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
    a = values.indexOf(a.value);
    b = values.indexOf(b.value);
    let N = values.length;
    if (a==b) {return 0;}
    let V = a - b;
    let result = 0;
    if ((V+N+1)%N == 0) {result = 1;}
    else if ((V+N-1)%N == 0) {result = -1;}
    return result;
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

class Foundation extends DragIn {
    constructor($root,x,y,suit,start) {
        super($root,x,y);
        this.$w.addClass("foundation");
        this.$w.html(start+suits[suit]);
        this.suit = suit;
        this.start = start;
        this.$overlay.on("mousedown",this.highlightNext);
        this.$overlay.on("mouseup",this.unhighlightNext);
        this.$overlay.appendTo(this.$w);
    }
    highlightNext() {
        for(let pile of sources) {
            if (this.ok(pile.top(),true)) {
                pile.highlight();
            }
        }
    }
    unhighlightNext() {
    }
    getDir(){
        return Compare(this.stack[0], this.stack[1]);
/*        let a = this.stack[0];
        let b = this.stack[1];
        if (a==undefined || b==undefined) {return 0;}
        if ((b-a+values.length-1)%values.length == 0) {return 1;}
        if ((b-a+values.length+1)%values.length == 0) {return -1;}
        return 0;
*/
    }
    
    ok(card,dontset) {
        if (!card) {return false;}
        if (card.suit!=this.suit){return false;}
        if (this.stack.length==0) {
            return card.value == this.start;
        }
        let a = values.indexOf(this.top().value);
        let b = values.indexOf(card.value);
        let dir = Compare(this.top(), card);
        if (dir==0) {return false;}
        if (dir*foundation.direction==1) {return true;}
        if(foundation.direction == 0) {
            return true;
        }
        return false;
    }
    doneQ() {
        if (Compare(foundation, this.top()) * foundation.direction == -1) {
            this.$overlay.addClass("done");
        } else {
            this.$overlay.removeClass("done")
        }
    }
    add(source, target) {
        super.add(source,target);
        this.doneQ();
    }
    remove() {
        super.remove();
        this.doneQ();
    }
}
function setSizes(Width) {
    cardwidth = Width/10.0;
    cardheight = Width/15.0;
    top = Width/30;
    left = Width/30;
    freetop = top + 7*cardheight;
    foundleft = left + 6.5*cardwidth;
    positions = {
        braid: {x:left, y: top},
        targets: {x:left, y:freetop, dx: cardwidth*1.5},
        free: {x: left, y:freetop + 1.5*cardheight + 0.5*cardheight, dx: cardwidth*1.5, dy: cardheight*1.5},
        foundation: {x: foundleft, y: top, dx: cardwidth*1.5, dy: cardheight*1.5},
        talon: {x: foundleft + cardwidth, y: freetop, dy: cardheight*1.5},
        shift: Width/12,
    }
    selection.shift = {x:-positions.shift, y:-positions.shift};
}
function init() {
    let $root = $("#canvas");
    $(window).on("resize",adjustPositions);
    let Width = $root.width();
    setSizes(Width);
    $root.on("mouseup",selection.dragend);
    $root.on("touchend",selection.dragend);
    $root.on("mousemove",(e)=>{selection.dragmove(e,e.buttons)});
    $root.on("touchmove",(e)=>{selection.dragmove(e,true);});
    let cards = makedeck($root);
    //BRAID--------------------
    let braid = new Braid($("#braid"));
    for (let i=0; i<20; i++) {
        braid.add(cards.pop());
    }
    let braidback = $("<img src='braidback.png'>").addClass("braidbg").appendTo($root)
        .css({//top: positions.braid.y + 2*cardheight,
              //left: positions.braid.x,
              width: 6*cardwidth,
              height: 6*cardwidth
        });
    //DOCKS
    for(let i=0; i<=3; i++) {
        let pile = new Dock($("#dock"),
                            0,
                            0,
                            braid);
        docks.push(pile);
        pile.add(cards.pop());
    }
    //FREE--------------------
    let free = [];
    for (let row = 0; row<2; row++) {
        for (let col=0; col<4; col++) {
            let pile = new Free($("#free"),
                                0,
                               0
                                 );

            free.push(pile);
            pile.add(cards.pop());
        }   
    }
    //FOUNDATION--------------------
    foundation.$arrow = $("#direction");
        /*.css({left: positions.foundation.x + positions.foundation.dx*0.75,
              top: positions.foundation.y + positions.foundation.dy*1.75,
              width: 2,
              height:2})*/;
    
    let card = cards.pop();
    foundation.value = card.value;
    foundation.keys = [];
    for (let suit of Object.keys(suits)) {
        for(let col of [0,1]) {
            let key = suit+col;
            foundation[key] = new Foundation($("#foundations"),
                                             0,0,
                                             suit, foundation.value);
            if (col==0 && suit==card.suit) {
                foundation[key].add(card);
            }
            foundation.keys.push(key);
        }
    }
    //TALON--------------------
    let $talon = $("#talonbox");
    let discard = new Discard($talon,0,0);

    let talon = new Talon($talon,
                          0,
                          0,
                          discard,cards);

    //BUTTONS--------------------
    let $avail = $("#available").on("click",(e,b=braid)=>{GetAvailable(b)});
    let $undo = $("#undo").on("click",Undo.undo);
    let $redo = $("#redo").on("click",(e)=>{Undo.redo()});

}

$(init)

