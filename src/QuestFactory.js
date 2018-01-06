'use strict';

const Quest = require('./Quest');
const Logger = require('./Logger');

/**
 * @property {Map} quests
 */
class QuestFactory {
  constructor() {
    this.quests = new Map();
  }

  add(areaName, id, config) {
    this.quests.set(this._makeQuestKey(areaName, id), config);
  }

  set(qid, val) {
    this.quests.set(qid, val);
  }

  /**
   * Get a quest definition. Use `create` if you want an instance of a quest
   * @param {string} qid
   * @return {object}
   */
  get(qid) {
    return this.quests.get(qid);
  }

  /**
   * @param {GameState} GameState
   * @param {string}    qid
   * @param {Player}    player
   * @param {Array}     state     current quest state
   * @return {Quest}
   */
  create(GameState, qid, player, state = []) {
    const quest = this.quests.get(qid);
    if (!quest) {
      throw new Error(`Trying to create invalid quest id [${qid}]`);
    }

    const instance = new Quest(GameState, qid, quest, player);
    instance.state = state;
    for (const goal of quest.goals) {
      const goalType = GameState.QuestGoalManager.get(goal.type);
      instance.addGoal(new goalType(instance, goal.config, player));
    }

    instance.on('progress', (progress) => {
      player.emit('questProgress', instance, progress);
      player.save();
    });

    instance.on('start', () => {
      player.emit('questStart', instance);
      instance.emit('progress', instance.getProgress());
    });

    instance.on('turn-in-ready', () => {
      player.emit('questTurnInReady', instance);
    });

    instance.on('complete', () => {
      for (const reward of quest.rewards) {
        try {
          const rewardClass = GameState.QuestRewardManager.get(reward.type);

          if (!rewardClass) {
            throw new Error(`Quest [${qid}] has invalid reward type ${reward.type}`);
          }

          rewardClass.reward(instance, reward.config, player);
        } catch (e) {
          Logger.error(e.message);
        }
      }

      player.emit('questComplete', instance);
      player.questTracker.complete(instance.id);

      player.save();
    });

    return instance;
  }

  /**
   * @param {string} areaName
   * @param {number} id
   * @return {string}
   */
  _makeQuestKey(area, id) {
    return area + ':' + id;
  }
}

module.exports = QuestFactory;
