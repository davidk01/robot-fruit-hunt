/*
 this should serve as a prototype for other strategy constructors.
 requires the constructor of the strategy that wants to use this as
 a prototype to initialize fruit_locations and init.
 */
var common_methods = {
  /*
   similar to find_fruits but instead of going through each cell of the board
   we only check the locations that we know had fruit to begin with.
   */
  update_fruits : function (board) {
    /*
     for each fruit recheck and reassign the locations of that
     fruit and at the same time update the list of fruits to ones
     that have a non-empty list of locations.
     */
    var fruits = this.fruit_stash.fruits;
    this.fruit_stash.fruits = fruits.filter(function (fruit) {
      var updated_locations = this.fruit_stash[fruit].filter(function (loc) {
        return board[loc[0]][loc[1]] > 0;
      });
      this.fruit_stash[fruit] = updated_locations;
      return updated_locations.length > 0;
    }, this);
  },
  /*
   go through the board and save all the fruit locations.
   also, while making a pass through the board we also keep
   track of how many fruits of that type we would need to
   get in order to win that category.
   */
  find_fruits_and_compute_win_counts : function (board) {
    board.forEach(function (column, col_index) {
      column.forEach(function (fruit_type, row_index) {
        var fruit_location = [col_index, row_index], fruit_locations;
        if (fruit_type > 0) {
          fruit_locations = this.fruit_stash[fruit_type];
          if (fruit_locations) {
            fruit_locations.push(fruit_location);
          } else {
            this.fruit_stash[fruit_type] = [fruit_location];
            this.fruit_stash.fruits.push(fruit_type);
            this.win_counts[fruit_type] = 0.5;
          }
          this.win_counts[fruit_type] += 0.5;
        }
      }, this);
    }, this);
  },
  /*
   we can only move up, down, left, right so the right metric to
   use is the manhattan metric, a.k.a. taxicab metric.
   */
  manhattan_metric : function (from, to) {
    return Math.abs(from[0] - to[0]) + Math.abs(from[1] - to[1]);
  },
  /*
   the game has a predefined set of constants for directional movement.
   so given where we want to move and some other location this function
   returns one of the direction specifiers that will get us closer to
   the desired location.
   */
  calculate_move_direction : function (move_location, my_location) {
    // figure out if we need to move left or right
    var x_delta = move_location[0] - my_location[0];
    if (x_delta !== 0) {
      return x_delta > 0 ? EAST : WEST;
    }
    // figure out if we need to move left or right
    var y_delta = move_location[1] - my_location[1];
    if (y_delta !== 0) {
      return y_delta > 0 ? SOUTH : NORTH;
    }
  },
  /*
   convenience function for updating fruit locations. this
   should be called on every turn of the game to update the
   locations of the fruits.
   */
  init_or_update_fruit_locations : function (board) {
    if (!this.init) {
      this.find_fruits_and_compute_win_counts(board);
      this.init = true;
    } else {
      this.update_fruits(board);
    }
  },
  /*
   finds the closest fruit to a given location. will throw
   an exception or return null if fruit_stash and fruit_stash.fruits
   don't contain anything. so this function will only return sensible
   results if our fruit_stash is sane.
   */
  find_closest_fruit : function (loc) {
    var closest_fruit = null, closest_distance = Infinity, fruit_stash = this.fruit_stash;
    fruit_stash.fruits.forEach(function (fruit) {
      fruit_stash[fruit].forEach(function (fruit_loc) {
        var distance = this.manhattan_metric(loc, fruit_loc);
        if (distance <= closest_distance) {
          closest_distance = distance;
          closest_fruit = fruit_loc;
        }
      }, this);
    }, this);
    return closest_fruit;
  }
};

/* this should work while I figure out a better way to do this */
function create_strategy_instance(Constructor) {
  /* set prototype and create an instance. */
  Constructor.prototype = common_methods;
  var instance = new Constructor();
  /* initialize common state. */
  instance.init = false;
  instance.fruit_stash = {fruits : []};
  instance.win_counts = {};
  /* return the new instance. */
  return instance;
}

/*
 the idea here is to use win_counts to ignore fruits that are
 a lost cause and to go after fruits that can potentially get
 us a win. this still doesn't beat the greedy strategy of going
 after the closest fruit first.
 */
function Still_Pretty_Greedy() {
  /*
   we want to get rid of fruit categories that we have no hope of winning or
   have already won. we have won a category if we have more than half of the fruit
   in that category and we have no hope of winning if the enemy can make the same claim.
   */
  this.filter_out_won_or_lost_categories = function () {
    return this.fruit_stash.fruits.filter(function (fruit) {
      var win_count = this.win_counts[fruit];
      var my_count = get_my_item_count(fruit), enemy_count = get_opponent_item_count(fruit);
      var total_collected = my_count + enemy_count;
      var keep = !(enemy_count >= win_count || total_collected === (2 * win_count - 1));
      return keep;
    }, this);
  };
  /*
   update fruit locations, filter out won/lost categories, find the closest
   fruit and try to go to it.
   */
  this.make_move = function (board) {
    this.init_or_update_fruit_locations(board);
    this.fruit_stash.fruits = this.filter_out_won_or_lost_categories();
    var my_loc = [get_my_x(), get_my_y()];
    if (this.fruit_stash.fruits.length === 0) {
      return PASS;
    }
    var fruit_loc = this.find_closest_fruit(my_loc);
    var move_direction = this.calculate_move_direction(fruit_loc, my_loc);
    return move_direction === undefined ? TAKE : move_direction;
  };
}

/* initialize a strategy instance when the game starts. */
var strategy;
function new_game() {
  strategy = create_strategy_instance(Still_Pretty_Greedy);
}

/* implementation of the contract required by the game engine. */
function make_move() {
  return strategy.make_move(get_board());
}
