import autoBind from "./autobind.js";

let DEBUG = false
let foundation = {};
let Ndocks=5;
let Nbraid=19;
let Nfree = 8;
let Ndecks = 2;
let docks = {};

let Z = {
    "canvas": 0,
    "cards": 100,
};
let suits = {"H":"&hearts;",
             "D":"&diams;",
             "S":"&spades;",
             "C":"&clubs;"};
let colors = {"H": "red",
              "D": "#A00",
              "S": "black",
              "C": "#00A"};
let values = ["A","2","3","4","5","6","7","8","9","10","J","Q","K"];
let sources = [];
let targets = [];
let piles = [];
let mycards = [];
let braid;
function randint(start,eww) {//a number start, start+1, ..., eww-1
    if (eww==undefined) {
        eww = start;
        start=0;
    }
    return Math.floor((eww-start)*Math.random())+start;
}
//------------------------------------------------------------
function adjustPositions() {
    let canvas = $("#canvas")[0].getBoundingClientRect();
    $(".card.bottom").toggle(canvas.height>canvas.width);
    for (let card of mycards) {
        if (!(card.pile instanceof Braid)) {
            card.adjustPosition();
        }
    }
}
/*function printstack(stack,label){
    let result = [];
    for (let card of stack) {
        if(card.str) {
            result.push(card.str());
        } else if (card.name)  {
            result.push(card.name);
        } else {
            result.push("<NIL>");
        }
    }
    console.log((label??"")+":"+result.join(' '));
}*/
let Undo = new class {
    constructor() {
        this.stack = [];
        this.rstack = [];
        this.add = this.add.bind(this);
        this.undo = this.undo.bind(this);
        this.active = false;
    }
    add(source,target,braidQ=false) {
        //dir is the direction of the foundation: -1,0,1
        braidQ = (source instanceof Dock);
        this.stack.push([source,target,braidQ]); //braidQ if the undo involves moving a card from source back to the braid
        this.output();
    }
    output() {
        let result=[];
        for (let item of this.stack) {
            result.push(item[0].name+"->"+item[1].name);
        }
        if(DEBUG) {console.debug("UNDO:",result.join(" "));}
    }
    undo() {
        if (this.stack.length==0) {return;}
        this.active=true;
        if(DEBUG) {console.debug("=====UNDOING=====");}
        let [source,target,braidQ] = this.stack.pop();
        if (target=="flip") {
            source.unflip();
        } else {
            if(braidQ) {
                if(DEBUG) {console.debug("::MOVING ",source.name," to BRAID");}
                braid.add(source.remove());
            }
            if(DEBUG) {console.debug("::MOVING ",target.name," to ",source.name);}
            source.add(target.remove());
            if(DEBUG) {console.debug("::DONE");}
            SetDirection();
        }
        this.rstack.push([source,target,braidQ]);
        this.active=false;
    }
    redo() {
        if (this.rstack.length==0) {return;}
        this.active=true;
        let [source,target,braidQ] = this.rstack.pop();
        if (target == "flip") {
            source.flip();
        } else {
            target.add(source.remove());
            source.add(braid.remove());
        }
        this.stack.push([source,target]);
        SetDirection();
        this.active=false;
    }
}
//------------------------------------------------------------

let selection = new class {
    constructor() {
        let shift = 
        this.$root = $("body");
        this.clear();
        this.shift = {x:0,y:0};
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
        if(DEBUG){console.debug("DRAGSTART");}
        this.unhighlight();
        this.card = pile.remove();
        let duh = this.card.$w[0].getBoundingClientRect();
        this.shift = {x:duh.left-e.clientX, y:duh.top-e.clientY};
        this.card.$w.addClass("dragging");
        this.source = pile;
        
    }
    dragend(e) {//UI
        console.debug("dragend");
        if(!this.card) {return;}
        if(DEBUG) {console.debug("DRAGEND");}
        this.card.$w.removeClass("dragging");
        if(!this.moved) {
            if (! AutoMoveToFoundation(this.source,this.card)) {
                this.source.add(this.card);//restore to the original pile
            }
        } else if (this.target && this.target.ok(this.card)) {
            this.target.add(this.card);
            Undo.add(this.source,this.target);
        } else {
            this.reject();
        }
        this.clear();
        IsDone();
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
class Card {
    constructor($root,suit,value) {
        this.$root = $root;
        this.suit = suit;
        this.value = value;
        let text = value+suits[suit];
        this.$w = $("<div>")
            .addClass("card")
            .addClass(`card${value}${suit}`);
        let span = $("<span>")
            .html(text) /*+"<p class=bottom>"+text+"</p>")*/
            .css({"color":colors[this.suit],
                 })
            .appendTo(this.$w);
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
    for (let n = 1; n<=Ndecks; n++) {
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
        this.$overlay.on("click",() => {//UI
            if(this.flip()) {
                Undo.add(this,"flip");
            }
            
        }
        );
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
            this.target.add(this.remove());
        }
        this.$overlay.toggleClass("empty",this.empty());
        return true;
    }
    unflip() {
        selection.unhighlight();
        if (this.target.empty()) {
            while (!this.empty()) {
                this.target.add(this.remove());
            }
            this.times--;
        } else {
            this.add(this.target.remove());
        }
        this.$overlay.toggleClass("empty",this.empty());
        return true;
    }
}

class Braid extends Pile {
    constructor($root,x,y){
        super($root,x,y,false);
        this.$w.addClass("braid");
        this.$overlay.remove();
/*        this.$background = $("<svg width=100% height=100%>")
            .appendTo(this.$root);
        $('<circle cx="50" cy="50" r="40" stroke="green" stroke-width="4" fill="yellow" />').appendTo(this.$background);*/
//        this.x = 10;
//        this.y = 10;
    }
    add(card) {
        if(card==undefined) {return;}
        if(DEBUG) {console.debug("BRAID ADD: %s",card.str());}
        this.output();
        super.add(card);
        this.output();
        card.$w.addClass("braidcard");
        this.flow();
        }
    output() {
        if (!DEBUG) {return;}
        let result = [];
        let result2 = [];
        for (let i of this.stack) {
            result.push(i.str());
        }
        result2 = DockString();
        console.debug("BRAID: ",result.join(' '),"\nDOCK: ",result2);
    }
    remove() {
        let debug;
        try {var a={}; a.debug();} catch(ex) {debug=ex.stack.split("\n");}
        if(DEBUG) {console.debug("BRAIDREMOVE TRACE",
            debug[1].replace("@http://localhost:7998/braid.js",""),
            debug[2].replace("@http://localhost:7998/braid.js","")
                                )};
        this.output();
        let card = super.remove();
        if(DEBUG){console.debug("BRAID REMOVE: ",card.str());}
        card.$w.removeClass("braidcard");
        this.output();
        this.flow();
        return card;
    }
    contains(card) {
        for(let i of this.stack) {
            if (card.value == i.value && card.suit == i.suit) {return true;}
        }
        return false;
    }
    alignment(i) {
        return this.pos(i)[2];
    }
    flow() {
        let N = this.stack.length;
        for (let i=0; i<N; i++) {
            this.stack[i].move(...this.pos(i+(20-N)));
        }
    }
    pos(i) {
        //x ranges from 0 to 3
        //y ranges from 0 to 6
        let x,y,align;
        if (i===0)      {x=0;                 y=4;    align="bottom";}
        else if (i<=3)  {x=0.5+0.04*(i-2);    y=4-i;  align="bottom";}
        else if (i==4)  {x=1;                 y=0;    align="";   }
        else if (i<=8)  {x=1.5 + 0.04*(i-6);  y=i-4;  align="top";}
        else if (i==9)  {x=2;                 y=5;    align="";}
        else if (i<=13) {x=2.5 + 0.04*(i-11); y=14-i; align="bottom";}
        else if (i==14) {x=3;                 y=0;    align="top";}
        else {x=3.5+0.04*(i-17);                y=i-14;  align="top";}
        let braidbox = $("#braid")[0].getBoundingClientRect();
        let L = [
            (braidbox.left + x * 0.20*braidbox.width),
            (braidbox.top  + y * 0.14*braidbox.height),
            align];
        return L;
    };
}
class DragOut extends Pile {
    constructor($root,x,y) {
        super($root,x,y);
        if (!(this instanceof Foundation)) {
            sources.push(this);
        }
        this.$overlay.on("click",(e,pile=this)=>{//UI
            console.debug("click");
            if (AutoMoveToFoundation(pile,pile.top())) {
                pile.remove();
                IsDone();
                //SetDirection();
            }
        });
        this.$overlay.on("mousemove",(e,pile=this)=>{
            console.debug("mousemove");
            if(e.buttons && !selection.card) {selection.dragstart(pile,e);}
        });
        this.$overlay.on("touchstart",(e,pile=this)=>{
            console.debug("touchstart");
            selection.dragstart(pile,e);
            e.preventDefault();
        });
    }
    highlight() {
        this.$w.addClass("highlight");
    }
}
function GetAvailable() {//UI
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
    if(movedFlag) {GetAvailable();}
}
class Discard extends DragOut {
    constructor($root,x,y) {
        super($root,x,y);
        this.$w.attr("id","discard");
        this.$overlay.html("Discard");
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
function DockString() {
    let result = [];
    for(let i=0; i<Ndocks; i++) {
        if(docks[i]) {
            if(docks[i].top()) {
                result.push(docks[i].top().str());
            }
        }
    }
    return result.join(" ");
}
class Dock extends DragIn {
    constructor($root,x,y,braid) {
        super($root,x,y);
        this.braid = braid;
    }
    add(card) {
        if(DEBUG) {console.debug("DOCK ADD: ",card.str());}
        super.add(card);
        this.callback();
    }
    remove() {
        let card = super.remove();
        if(DEBUG) {console.debug("DOCK REMOVE: ",card.str());}
        this.callback();
        return card;
    }
    callback() {
        if(DEBUG){console.group("CALLBACK: "+this.name);}
        if(this.empty() && !Undo.active) {
            let card = this.braid.remove();
            if(DEBUG) {console.debug("removing from braid:",card.str());}
            if (card) {this.add(card);
            }
        }
        if (this.stack.length==2) {
            this.braid.add(this.stack.shift());
        }
        if(DEBUG) {console.groupEnd();}
    }
}
    foundation.direction = 0;

function AutoMoveToFoundation(pile,card) {//UI
    if(DEBUG) {console.debug("AUTO");}
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
        CheckWin()
    }
    add(source, target) {
        super.add(source,target);
        this.doneQ();
    }
    remove() {
        let result = super.remove();
        this.doneQ();
        return result;
    }
}
function CheckWin() {
    let total = 0;
    let result = [];
    for (let key of foundation.keys) {
        result.push(key+":"+foundation[key].stack.length);
            total += foundation[key].stack.length;
    }
    $("#win").toggleClass("win",total==104);
    if(DEBUG) {console.debug("total=",total,result.join(" "));}
}
function IsDone() {
    CheckWin();
    selection.unhighlight();
    adjustPositions();
    SetDirection();
}
function init() {
    let $root = $("#canvas");
    $(window).on("resize",IsDone);
    let Width = $root.width();
    $root.on("mouseup",selection.dragend);//UI
    $root.on("touchend",selection.dragend);//UI
    $root.on("mousemove",(e)=>{selection.dragmove(e,e.buttons)});
    $root.on("touchmove",(e)=>{selection.dragmove(e,true);});
    let cards = makedeck($root);
    //BRAID--------------------
    braid = new Braid($("#braid"));
    braid.name = "@B";
    for (let i=0; i<Nbraid; i++) {
        braid.add(cards.pop());
        let card = braid.top();
        card.align = braid.alignment(braid.stack.length);
        if (card.align) {
            card.$w.addClass("align"+card.align);
        }
    }
    let braidback = $("<img src='braidback.png'>").addClass("braidbg").appendTo("#braid");
    //DOCKS
    for(let i=0; i<Ndocks; i++) {
        let pile = new Dock($("#dock"),0,0,braid);
        pile.name = "@D"+(i+1);
        pile.add(cards.pop());
        docks[i] = pile;
    }
    DockString();
    //FREE--------------------
    let free = [];
    for (let row = 0; row<2; row++) {
        for (let col=0; col<Nfree; col+=2) {
            let pile = new Free($("#free"),0,0);
            pile.name= "@Fr"+(row+1)+(col+1);
            free.push(pile);
            pile.add(cards.pop());
        }   
    }
    //FOUNDATION--------------------
    foundation.$arrow = $("#direction");
    
    let card = cards.pop();
    foundation.value = card.value;
    foundation.keys = [];
    for (let suit of Object.keys(suits)) {
        for (let col=0; col<Ndecks; col++) {
            let key = suit+col;
            foundation[key] = new Foundation($("#foundations"),
                                             0,0,
                                             suit, foundation.value);
            foundation[key].name = "@F"+suit+(col+1);
            if (col==0 && suit==card.suit) {
                foundation[key].add(card);
            }
            foundation.keys.push(key);
        }
    }
    //TALON--------------------
    let $talon = $("#talonbox");
    let discard = new Discard($talon,0,0);
    discard.name = "@Dd";
    let talon = new Talon($talon,
                          0,
                          0,
                          discard,cards);
    talon.name = "@T";
    //BUTTONS--------------------
    let $avail = $("#available").on("click",(e)=>{GetAvailable()});//UI
    let $undo = $("#undo").on("click",Undo.undo);
    let $redo = $("#redo").on("click",(e)=>{Undo.redo()});
    braid.output();
    IsDone();
    $("#rules").on("click",()=>{$("#popup").toggle();});
    console.log("=====READY2=====");
    
}

$(init)

