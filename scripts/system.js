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

Game.system.pcHere = function (x, y) {
  let pcX = Game.getEntity('pc').Position.getX()
  let pcY = Game.getEntity('pc').Position.getY()

  return (x === pcX) && (y === pcY)
}

Game.system.isAltar = function (x, y) {
  return x === Game.getEntity('altar').Position.getX() &&
    y === Game.getEntity('altar').Position.getY()
}

Game.system.isItem = function (x, y) {
  for (const keyValue of Game.getEntity('item')) {
    if (x === keyValue[1].Position.getX() && y === keyValue[1].Position.getY()) {
      return keyValue[1]
    }
  }
  return null
}

Game.system.pcAct = function () {
  Game.getEntity('timer').engine.lock()

  if (Game.getEntity('harbinger').Counter.hasGhost()) {
    Game.input.listenEvent('add', lure)
  } else {
    Game.input.listenEvent('add', 'main')
  }

  // helper function
  function lure (e) {
    let item = Game.input.getAction(e, 'drop')
    let message = Game.getEntity('message').Message
    let bag = Game.getEntity('pc').Bagpack

    if (item) {
      if (bag.dropItem(item, true)) {
        message.pushMsg(Game.text.interact('drop', item))
        message.pushMsg(Game.text.encounter('reaction', item))

        Game.input.listenEvent('remove', lure)
        Game.system.resetHarbinger(item)
        Game.system.unlockEngine(1)
      } else {
        message.setModeline(Game.text.encounter('more'))
      }
    } else {
      message.setModeline(Game.text.encounter('invalid'))
    }

    Game.display.clear()
    Game.screens.main.display()
  }
}

Game.system.harbingerAct = function () {
  let message = Game.getEntity('message').Message
  let unlock = true

  Game.getEntity('timer').engine.lock()

  switch (Game.getEntity('harbinger').Counter.countdown()) {
    case 'warning':
      message.pushMsg(Game.text.encounter('warn'))
      break
    case 'ghost':
      if (Game.system.isDead()) {
        message.pushMsg(Game.text.encounter('lose'))
        message.pushMsg(Game.text.encounter('end'))

        unlock = false
      } else {
        message.pushMsg(Game.text.encounter('appear'))

        if (!Game.getEntity('altar').Sacrifice.getDrawAltar()) {
          Game.system.placeAltar(false)
        } else {
          Game.system.placeAltar(true)
        }
        Game.system.placeItem(Game.system.placeFog())
      }
      break
  }

  unlock && Game.system.unlockEngine(1)
}

Game.system.move = function (direction) {
  let actor = Game.getEntity('pc')
  let duration = actor.Bagpack.getSpeed()
  let x = actor.Position.getX()
  let y = actor.Position.getY()
  let message = Game.getEntity('message').Message

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
    Game.system.isItem(x, y) &&
      message.pushMsg(Game.text.interact('find',
        Game.system.isItem(x, y).getEntityName()))

    actor.Position.setX(x)
    actor.Position.setY(y)

    Game.input.listenEvent('remove', 'main')
    Game.system.unlockEngine(duration)
  } else if (Game.system.isAltar(x, y)) {
    if (Game.system.sacrificeItem()) {
      message.pushMsg(Game.text.altar('sacrifice'))
      message.pushMsg(Game.text.altar('reaction',
        Game.getEntity('altar').Sacrifice.getAltarName()))

      actor.Bagpack.pickItem('rune')
      Game.getEntity('altar').Sacrifice.nextAltar()
      Game.system.resetAltar()
      if (actor.Bagpack.getRune() === 3) {
        message.pushMsg(Game.text.altar('win'))
        message.pushMsg(Game.text.altar('turn'))
        message.pushMsg(Game.text.encounter('end'))

        Game.input.listenEvent('remove', 'main')
      } else {
        Game.input.listenEvent('remove', 'main')
        Game.system.unlockEngine(1)
      }
    } else {
      message.setModeline(Game.text.encounter('more'))
    }
  } else {
    message.setModeline(Game.text.interact('forbidMove'))
  }
}

Game.system.unlockEngine = function (duration) {
  Game.getEntity('timer').scheduler.setDuration(duration)
  Game.getEntity('timer').engine.unlock()

  Game.display.clear()
  Game.screens.main.display()
}

Game.system.pickUp = function (x, y) {
  let item = Game.system.isItem(x, y)

  if (!item) {
    Game.getEntity('message').Message.setModeline(
      Game.text.interact('emptyFloor'))

    return false
  }

  if (Game.getEntity('pc').Bagpack.pickItem(item.getEntityName())) {
    Game.getEntity('message').Message.pushMsg(
      Game.text.interact('pick', item.getEntityName()))

    Game.getEntity('item').delete(item.getID())
    Game.system.unlockEngine(1)

    return true
  } else {
    Game.getEntity('message').Message.setModeline(
      Game.text.interact('fullBag'))

    return false
  }
}

Game.system.drop = function (item) {
  let x = Game.getEntity('pc').Position.getX()
  let y = Game.getEntity('pc').Position.getY()

  if (Game.system.isItem(x, y)) {
    Game.getEntity('message').Message.setModeline(
      Game.text.interact('occupiedFloor'))

    return false
  }

  if (!Game.getEntity('pc').Bagpack.dropItem(item)) {
    Game.getEntity('message').Message.setModeline(
      Game.text.interact('emptyBag'))

    return false
  } else {
    Game.entity[item](x, y)

    Game.getEntity('message').Message.pushMsg(
      Game.text.interact('drop', item))
    Game.system.unlockEngine(1)

    return true
  }
}

Game.system.isDead = function () {
  let hasSkull = Game.getEntity('pc').Bagpack.getSkull() > 0
  let hasCoin = Game.getEntity('pc').Bagpack.getCoin() > 1
  let hasGem = Game.getEntity('pc').Bagpack.getGem() > 0

  return !(hasSkull || hasCoin || hasGem)
}

Game.system.resetHarbinger = function (item) {
  Game.getEntity('harbinger').Counter.reset(item)
  Game.getEntity('harbinger').Position.setX(null)
  Game.getEntity('harbinger').Position.setY(null)
}

Game.system.placeItem = function (emptyFloor) {
  let maxSkull = !emptyFloor ? 18 : skullInFog()
  let maxCoin = !emptyFloor
    ? 4 + Math.floor(ROT.RNG.getUniform() * 5)
    : coinInFog()
  let maxGem = !emptyFloor ? 0 : gemInFog()
  let x = null
  let y = null

  let width = Game.getEntity('dungeon').Dungeon.getWidth()
  let height = Game.getEntity('dungeon').Dungeon.getHeight()

  for (let i = 0; i < maxSkull; i++) {
    Game.entity.skull.apply(null, findPosition())
  }
  for (let i = 0; i < maxCoin; i++) {
    Game.entity.coin.apply(null, findPosition())
  }
  for (let i = 0; i < maxGem; i++) {
    Game.entity.gem.apply(null, findPosition())
  }

  function findPosition () {
    let maxTry = 99
    do {
      if (!emptyFloor) {
        x = Math.floor(ROT.RNG.getUniform() * width)
        y = Math.floor(ROT.RNG.getUniform() * height)
      } else {
        x = emptyFloor[Math.floor(ROT.RNG.getUniform() * emptyFloor.length)]
        y = Number.parseInt(x.split(',')[1], 10)
        x = Number.parseInt(x.split(',')[0], 10)
      }
      maxTry--
    } while (!Game.system.isFloor(x, y) || Game.system.isAltar(x, y) ||
    Game.system.isItem(x, y) || Game.system.pcHere(x, y) || maxTry > 0)

    return [x, y]
  }

  function gemInFog () {
    return Math.max(1, Math.floor(ROT.RNG.getUniform() * 3))
  }
  function coinInFog () {
    return Math.floor(ROT.RNG.getUniform() * 3 + 2)
  }
  function skullInFog () {
    return Math.floor(ROT.RNG.getUniform() * 5 + 4)
  }
}

Game.system.placeAltar = function (isFog) {
  let altar = Game.getEntity('altar')
  let fog = Game.getEntity('fog')
  let pcX = Game.getEntity('pc').Position.getX()
  let width = Game.getEntity('dungeon').Dungeon.getWidth()
  let height = Game.getEntity('dungeon').Dungeon.getHeight()

  let x = null
  let y = null

  do {
    x = Math.floor(width * ROT.RNG.getUniform())
    y = Math.floor(height * ROT.RNG.getUniform())
  } while (!Game.system.isFloor(x, y) || Game.system.isItem(x, y) ||
  !Game.system.isReachable(x, y) ||
  x < 0 || x >= width || Math.abs(x - pcX) < Math.floor(width / 3) ||
  y < 0 || y >= height)

  if (!isFog) {
    altar.Position.setX(x)
    altar.Position.setY(y)
  }
  fog.Position.setX(x)
  fog.Position.setY(y)
  altar.Sacrifice.drawAlatr(true)
}

Game.system.sacrificeItem = function () {
  let needItem = Game.getEntity('altar').Sacrifice.getItemList()
  let bag = Game.getEntity('pc').Bagpack
  let hasItem = bag.getSkull() >= needItem[0] &&
    bag.getCoin() >= needItem[1] &&
    bag.getGem() >= needItem[2]

  if (hasItem) {
    for (let i = 0; i < needItem[0]; i++) {
      bag.dropItem('skull')
    }
    for (let i = 0; i < needItem[1]; i++) {
      bag.dropItem('coin')
    } for (let i = 0; i < needItem[2]; i++) {
      bag.dropItem('gem')
    }
    return true
  }
  return false
}

Game.system.isReachable = function (x, y) {
  let surround = [[x - 1, y - 1], [x - 1, y], [x - 1, y + 1],
  [x, y - 1], [x, y + 1],
  [x + 1, y - 1], [x + 1, y], [x + 1, y + 1]]

  for (let i = 0; i < surround.length; i++) {
    if (!Game.system.isFloor(...surround[i])) {
      return false
    }
  }
  return true
}

Game.system.resetAltar = function () {
  Game.getEntity('altar').Sacrifice.drawAlatr(false)
  Game.getEntity('altar').Position.setX(null)
  Game.getEntity('altar').Position.setY(null)
}

Game.system.placeFog = function () {
  let centerX = Game.getEntity('fog').Position.getX()
  let centerY = Game.getEntity('fog').Position.getY()
  let sight = Game.getEntity('fog').Position.getSight()
  let dungeon = Game.getEntity('dungeon')
  let fog = []
  let memory = null

  dungeon.fov.compute(centerX, centerY, sight, function (x, y) {
    Game.system.isItem(x, y) &&
      Game.getEntity('item').delete(Game.system.isItem(x, y).getID())

    memory = dungeon.Dungeon.getMemory().filter((i) => {
      return i !== x + ',' + y
    })
    dungeon.Dungeon.setMemory(memory)

    fog.push(x + ',' + y)
  })

  return fog
}
