let cardwidth = 30;
let cardheight = 20;
let Z = {
    "canvas": 0,
    "cards": 100,
};
let suits = {"H":"&hearts;",
             "D":"&diams;",
             "S":"&spades;",
             "C":"&clubs;"};
let colors = {"H": "red",
              "D": "#f8f",
              "S": "black",
              "C": "blue"};
let values = ["A","2","3","4","5","6","7","8","9","10","J","Q","K"];
let piles = [];
function randint(start,eww) {//a number start, start+1, ..., eww-1
    if (eww==undefined) {
        eww = start;
        start=0;
    }
    return Math.floor((eww-start)*Math.random())+start;
}
let selected = null;
let dragged = false;
let activepile = null;
class Card {
    constructor($root,suit,value,flipQ) {
        this.$root = $root;
        this.suit = suit;
        this.value = value;
        this.pile = null;
        this.lastpile = null;
        this.$w = $("<div>")
            .addClass("card")
            .addClass(`card${value}${suit}`)
            .html(value+suits[suit])
            .css({"color":colors[this.suit]});
        
        this.back = $("<div>").addClass("back").appendTo(this.$w);
        this.frontQ = false;
        this.toggle = this.toggle.bind(this);
        this.flipQ = flipQ;
        this.x=0; this.y=0;
        this.dragstart = this.dragstart.bind(this);
        this.dragend = this.dragend.bind(this);
        this.$w.on("mousedown",this.dragstart);
        this.$w.on("mouseup",this.dragend);
        //QUESTION: 
        this.$w.appendTo(this.$root);

    }
    move(x,y) {
        this.$w.css({top: y, left: x});
        this.x = x; this.y = y;
    }
    returntopile() {
        if (this.lastpile) {
            console.log("returning to %s",this.lastpile.label)
            this.pile = this.lastpile;
            this.lastpile = null;
            this.pile.add(this);
        }
    }
    toggle(onQ) {
        this.frontQ = onQ??!this.frontQ;
        if(this.frontQ) {this.back.hide();} else {this.back.show();}
    }
    dragstart(e) {
        this.dragX = e.pageX - this.x;
        this.dragY = e.pageY - this.y;
        this.dragX = -25; this.dragY=-20;
        this.$w.addClass("dragging");
        selected = this;
        dragged = false;
        if(this.pile) {this.pile.remove();}
        
    }
    dragend(e) {
        selected = null;
        dragged = false;
        this.$w.removeClass("dragging");
        console.debug("Calling dragend");
        if(activepile) {console.debug("Active pile %d has %d cards",activepile.label,activepile.stack.length)}
        else {console.debug("No active pile");}

        if (activepile) {
            if (activepile.targetable && activepile.ok(this)) {
                activepile.add(this);
            } else {
                this.returntopile();
            }
            activepile.hoverOut();
        } else {
            this.returntopile();
        }
        activepile=null;
    }
}
function makedeck($root) {
    let cards = [];
    for (let n = 1; n<=2; n++) {
        for (let suit of "DHCS") {
            for (let val of values) {
                let pos = randint(0,cards.length);
                cards.splice(pos, 0, new Card($root,suit,val)); //inserts randomly
            }
        }
    }
    console.log(cards);
    let card1 = cards.splice(-1,1)[0];
    let pos = randint(0,cards.length);
    cards.splice(pos,0,card1);
    return cards;
}
class Pile {
    constructor($root,x,y,faceUp,targetable) {
        this.x = x;
        this.y = y;
        this.label = piles.length;
        this.$root = $root;
        this.$w = $("<div>").addClass("pile")
            .css({top: y, left: x}).appendTo($root);
        this.$overlay = $("<div>").addClass("overlay").appendTo(this.$w);
        this.$overlay.toggleClass("faceup",faceUp);
        this.add = this.add.bind(this);
        this.remove = this.remove.bind(this);
        this.remove = this.remove.bind(this);
        this.hoverIn = this.hoverIn.bind(this);
        this.hoverOut = this.hoverOut.bind(this);
        this.ok = this.ok.bind(this);
        this.$w.on("click", (e)=>{this.remove();});
        this.$w.on("mouseenter", this.hoverIn);
        this.$w.on("mouseleave", this.hoverOut);
        this.stack = [];
        this.target = null;
        this.faceUp = faceUp;
        this.targetable = targetable;
        piles.push(this);
    }
    insideQ(x,y) {
        let R = this.$w[0].getBoundingClientRect();
        
        return (x>=R.left && x<=R.right && y>=R.top && y<=R.bottom)
    }
    ok(card) {
        return this.stack.length==0;
    }
    hoverIn(e) {
        this.$w.addClass("hover");
    }
    hoverOut(e) {
        this.$w.removeClass("hover");
    }
    add(card) {
        this.stack.push(card);
        card.$w.css({"z-index":Z.cards + this.stack.length});
        card.toggle(this.faceUp);
        card.pile = this;
        card.move(this.x, this.y);
        console.log("adding %o with z=",card,card.$w.css("z-index"),card.$w)
        console.debug("to pile %d with %d cards.",this.label,this.stack.length);
    }
    remove() {
        let card = this.stack.pop();
        card.lastpile = this;
        if(this.target) {
            this.target.add(card);
            card.pile = this.target;
        } else {
            card.pile = null;
        }
        console.debug("removing %o from pile %d which now has %d cards.",this.card,this.label,this.stack.length);
    }
    top() {
        if (this.stack.length==0) {return null;}
        return this.stack[this.stack.length-1];
    }
}
let builddirection = 0;
function SetDirection(dir) {
    builddirection=dir;
    //change gui to match
}
class Foundation extends Pile {
    constructor($root,x,y,suit,start) {
        super($root,x,y,true,true);
        this.$w.html(start+suits[suit]);
        this.suit = suit;
        this.start = start;
        
    }
    ok(card) {
        console.debug({card:card, tsuit: this.suit, tstart: this.start});
                       
        if (card.suit!=this.suit){return false;}
        if (this.stack.length==0) {
            return card.value == this.start;
        }
        let a = values.indexOf(this.top().value);
        let b = values.indexOf(card.value);
        let dir = 0;
        if ((b-a+values.length-1)%values.length == 0) {dir=1;}
        if ((b-a+values.length+1)%values.length == 0) {dir=-1;}
        if (dir==0) {return false;}
        if (dir*builddirection==1) {return true;}
        //if (buildup && builddirection>0) {return true;}
        //if (builddown && builddirection<0) {return true;}
        if(builddirection == 0) {
            SetDirection(dir);
            return true;
        }
        //if ((buildup||builddown) && builddirection==0) {
            //if(buildup) {SetDirection(1); return true;}
            //if(builddown) {SetDirection(-1); return true;}
        //}
        return false;
    }
}
function dragmove(e) {
    dragged = true;
    if (e.buttons && selected) {
        selected.move(e.pageX + selected.dragX,
                      e.pageY + selected.dragY);
    }
    activepile = null;
    for(let p of piles) {
        if (p.insideQ(e.pageX, e.pageY)) {
            activepile = p;
            p.hoverIn();
        } else {
            p.hoverOut();
        }
    }
}
function init() {
    let $root = $("#canvas");
    $root.on("mousemove",dragmove);
    let cards = makedeck($root);
    let braid = [];
    //Turn this into a special kind of pile where you can only remove from the top
    for (let i=0; i<20; i++) {
        let pile = new Pile($root,cardwidth+(i%2)*cardwidth*0.5, 0.9*cardheight*i,true,false);
        braid.push(pile);
        pile.add(cards.pop());
    }
    let talon = new Pile($root,100,100,false,false);
    let discard = new Pile($root,150,100,true,false);
    let target = new Pile($root,200,200,true,true);
    let foundation = new Foundation($root,200,100,"H","A");
    talon.target = discard;
    for (let card of cards) {
        talon.add(card);
        card.pile = talon;
    }
}

$(init)

