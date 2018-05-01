'use strict'

Game.system = {}

Game.system.isFloor = function (x, y) {
  return Game.getEntity('dungeon').Dungeon.getTerrain().get(x + ',' + y) === 0
}

Game.system.placePC = function () {
  let x = null
  let y = null
  let width = Game.getEntity('dungeon').Dungeon.getWidth()
  let height = Game.getEntity('dungeon').Dungeon.getHeight()
  let border = Game.getEntity('pc').Position.getSight()

  do {
    x = Math.floor(width * ROT.RNG.getUniform())
    y = Math.floor(height * ROT.RNG.getUniform())
  } while (!Game.system.isFloor(x, y) ||
  x < border || x > width - border ||
  y < border || y > height - border)

  Game.getEntity('pc').Position.setX(x)
  Game.getEntity('pc').Position.setY(y)
}

Game.system.isPC = function (actor) {
  return actor.getID() === Game.getEntity('pc').getID()
}

Game.system.isAltar = function (x, y) {
  return false
}

Game.system.pcAct = function () {
  Game.getEntity('timer').engine.lock()
  if (Game.getEntity('harbinger').Counter.hasGhost()) {
    Game.input.listenEvent('add', lure)
  } else {
    Game.input.listenEvent('add', 'main')
  }

  function lure (e) {
    if (e.key === 'Escape') {
      console.log('ghost is away')

      Game.input.listenEvent('remove', lure)
      Game.getEntity('harbinger').Counter.reset()
      Game.system.unlockEngine(1)
    } else {
      console.log('invalid key')
    }
  }
}

Game.system.harbingerAct = function () {
  Game.getEntity('timer').engine.lock()

  switch (Game.getEntity('harbinger').Counter.countdown()) {
    case 'warning':
      console.log('10 turns left')
      break
    case 'ghost':
      console.log('ghost appears')
      break
  }

  Game.system.unlockEngine(1)
}

Game.system.move = function (direction) {
  let actor = Game.getEntity('pc')
  let duration = actor.Bagpack.getSpeed()
  let x = actor.Position.getX()
  let y = actor.Position.getY()

  switch (direction) {
    case 'left':
      x -= 1
      break
    case 'right':
      x += 1
      break
    case 'up':
      y -= 1
      break
    case 'down':
      y += 1
      break
  }

  if (Game.system.isFloor(x, y) && !Game.system.isAltar(x, y)) {
    actor.Position.setX(x)
    actor.Position.setY(y)

    Game.input.listenEvent('remove', 'main')
    Game.system.unlockEngine(duration)
  } else {
    console.log('you cannot move there')
  }
}

Game.system.unlockEngine = function (duration) {
  Game.getEntity('timer').scheduler.setDuration(duration)
  Game.getEntity('timer').engine.unlock()

  Game.display.clear()
  Game.screens.main.display()
}
