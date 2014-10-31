// Using a constant timestep for now.
var TIMESTEP = 16;

function Overscroll(max_offset) {
  // Constants to configure spring physics
  this.SPRING_CONSTANT = 0.0003;
  this.DAMPING = 0.5;
  this.SPRING_LERP_POW = 4;
  this.FRICTION = 0.95;

  var self = this;
  var d = 0;
  var v = 0;
  var target = null;
  var prev_time = 0;

  // Time since last fling, or null if not in fling.
  var fling_time = null;

  // Only used for tweaking via developer console.
  this.setParms = function(k, b) {
    this.SPRING_CONSTANT = k;
    this.DAMPING = b;
  }

  this.setTarget = function(t) {
    target = t;
    v = 0;
    fling_time = null;
    prev_time = 0;
  }

  this.setVelocity = function(vel) {
    fling_time = 0;
    v = vel;
  }

  this.addFriction = function(delta) {
    if (delta < 0) {
      return delta;
    }

    delta = delta / max_offset;
    return max_offset * delta / (1 + delta);
  }

  this.reachedTarget = function() {
    return Math.abs(d - target) < 1 && v === 0;
  }

  this.step = function(time) {
    if (target === null && v === 0) {
      return false;
    }

    console.log("TARGET " + target);

    var current_distance = d;

    var target_pos = target === null ? 0 : target;
    var delta = time - prev_time;

    // If we don't have information on elapsed time, assume it's been 30 ms
    // since the last update.
    if (prev_time === 0) {
      delta = TIMESTEP;
    }

    prev_time = time;
    if (fling_time !== null) {
      fling_time += delta;
    }

    var lerp = 1;
    if (fling_time !== null && fling_time < 500) {
      lerp = fling_time / 500;
    }

    var a = Math.pow(lerp, this.SPRING_LERP_POW) *
        (this.SPRING_CONSTANT * (target - d));
    v *= this.FRICTION;
    v += a * delta;
    // Using the velocity after applying the acceleration due to the spring
    // keeps the simulation more stable.
    var dampening = Math.pow(lerp, this.SPRING_LERP_POW) * this.DAMPING * v;
    v -= dampening;
    d += v * delta;

    if (target_pos - d > -0.1 && v <= 0) {
      v = 0;
      d = target;
      target = null;
      prev_time = 0;
    }

    return d !== current_distance;
  }

  this.setOffset = function(o) {
    fling_time = Number.MAX_VALUE;
    prev_time = 0;
    target = null;
    d = o;
    v = 0;
  }

  this.getOffset = function() {
    return d;
  }
}

Polymer('polymer-p2r', {
  ready: function() {
    var self = this;
    var p2r = self.$.p2r;
    var scroller = self.$.scroller;

    var scrollcontent = self.$.scrollcontent;
    var loadingOffset = 150;

    var overscroll = new Overscroll(window.innerHeight);
    var global_offset = 0;
    var inScroll = false;

    function getHeaderClassName() {
      return self.className;
    }

    function setHeaderClassName(name) {
      self.className = name;
    }

    function translateY(element, offset) {
      element.style.webkitTransform = 'translate3d(0, ' + offset + 'px, 0)';
    }

    function checkPulled() {
      if (!inScroll)
        return;
      var triggerOffset = 60;
      if (getHeaderClassName() != 'loading') {
        setHeaderClassName(overscroll.getOffset() > triggerOffset ? 'pulled' : 'neutral');
      }
    }

    var time = 0;
    function onAnimationFrame() {
      // TODO: better physics, with a better timestep.
      time += TIMESTEP;

      // TODO - figure out when we can avoid scheduling updates.
      requestAnimationFrame(onAnimationFrame);

      if (!overscroll.step(time) && overscroll.getOffset() == 0)
        return;

      global_offset = overscroll.getOffset();

      if (global_offset < 0)
        global_offset = scroller.scrollTop;

      if (overscroll.getOffset() < 0) {
        scroller.scrollTop = -overscroll.getOffset();
        overscroll.setOffset(0);
        console.log("SET TO 0");
      }

      var offset = overscroll.addFriction(overscroll.getOffset());
      var clientHeight = p2r.clientHeight;

      checkPulled();
      translateY(scrollcontent, offset);
      translateY(p2r, offset - clientHeight);
    }

    function isP2rVisible() {
      return scroller.scrollTop <= overscroll.getOffset();
    }

    function isPulling() {
      return overscroll.getOffset() > 0;
    }

    function finishPull(velocity) {
      if (getHeaderClassName() == 'pulled') {
        setHeaderClassName('loading');
        setTimeout(finishLoading, 2000);
        if (velocity > -2)
          overscroll.setTarget(loadingOffset);
        overscroll.setVelocity(velocity);
      } else {
        console.log(scroller.scrollTop);
        overscroll.setTarget(0);
        overscroll.setVelocity(velocity);
      }
    }

    function finishLoading() {
      setHeaderClassName('neutral');
      if (!inScroll)
        overscroll.setTarget(0);
    }

    scroller.addEventListener('touchstart', function(e) {
      if (isPulling())
        overscroll.setOffset(global_offset);
    });

    scroller.addEventListener('beforescroll', function(e) {
      inScroll = !e.isEnding;
      global_offset += e.deltaY;

      console.log("GLOBAL " + global_offset);

      overscroll.setOffset(global_offset);

      if (global_offset > 0) {
        e.consumeDelta(e.deltaX, e.deltaY);
        scroller.scrollTop = 0;
      }

      if(e.isEnding && isPulling())
        finishPull(e.velocityY / 1000);
    });
    requestAnimationFrame(onAnimationFrame);
  }
});
