/*
methods that don't really depend on accessing the API
provided by the game engine should go here. there is no
point in putting such functions into the strategy prototype.
 */
var coordinate_functions = {
  /* taxicab metric */
  manhattan_metric : function (from, to) {
    "use strict";
    return Math.abs(from[0] - to[0]) + Math.abs(from[1] - to[1]);
  },
  /*
  the start and end points can be in the following configurations:
     s  +  o      o  -  s      o  +  e      e  -  o                              s      e
  1) +     +  2)  +     +  3)  -     -  4)  -     -  5)  s  +  e  6)  e - s  7)  +  8)  -
     o  +  e      e  -  o      s  +  o      o  -  s                              e      s
  we want to return coordinates that will make the box look like:
  l  #  o
  #     #  or   l # r
  o  #  r
  because we don't really care about how the path from start to end
  is oriented.
   */
  box_coordinates_from_endpoints : function (start, end) {
    var col_delta = end[0] - start[0], row_delta = end[1] - start[1];
    var orientation = col_delta * row_delta;
    if (orientation === 0) { /* degenerate case of horizontal or vertical line */
      if (col_delta === 0) { /* vertical line, config 7) or 8)*/
        return row_delta > 0 ? {left : start, right : end} : {left : end, right : start};
      } else { /* row_delta === 0 : horizontal line, config 5) or 6) */
        return col_delta > 0 ? {left : start, right : end} : {left : end, right : start};
      }
    } else if (orientation > 0) { /* this is config 1) or 4) */
      if (col_delta > 0) { /* config 1) */
        return {left : start, right : end};
      } else { /* config 4) */
        return {left : end, right : start};
      }
    } else { /* orientation < 0 : this is config 2) or 3) */
      var shifted_start = [start[0] + col_delta, start[1]];
      var shifted_end = [end[0] - col_delta, end[1]];
      if (col_delta < 0) { /* config 2) */
        return {left : shifted_start, right : shifted_end};
      } else { /* config 4) */
        return {left : shifted_end, right : shifted_start};
      }
    }
  }
};

/*
 this should serve as a prototype for other strategy constructors.
 requires the constructor of the strategy that wants to use this as
 a prototype to initialize fruit_locations and init.
 */
var common_strategy_methods = {
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
        var distance = coordinate_functions.manhattan_metric(loc, fruit_loc);
        if (distance <= closest_distance) {
          closest_distance = distance;
          closest_fruit = fruit_loc;
        }
      });
    });
    return closest_fruit;
  },
  /* given coordinates of some bounding box we return
  the locations of all the fruits that will fit in that box.
   */
  fruits_in_a_box : function (top_left_endpoint, bottom_right_endpoint) {
    var left_col_limit = top_left_endpoint[0], right_col_limit = bottom_right_endpoint[0];
    var top_row_limit = top_left_endpoint[1], bottom_row_limit = bottom_right_endpoint[1];
    var fruit_stash = this.fruit_stash, potential_fruit_locations = [];
    fruit_stash.fruits.forEach(function (fruit) {
      fruit_stash[fruit].filter(function (fruit_location) {
        /* check column limits */
        if (fruit_location[0] >= left_col_limit && fruit_location[0] <= right_col_limit) {
          /* check row limits */
          if (fruit_location[1] <= top_row_limit && fruit_location[1] >= bottom_row_limit) {
            potential_fruit_locations.push(fruit_location);
          }
        }
      });
    });
    return potential_fruit_locations;
  },
  /* if there is a rare fruit, i.e. only one of it exists
  then getting it will give us an advantage so we chart
  a path to it that goes through as many fruits as possible.
  we can solve the problem more generally by taking two points
  and trying to chart a path from one to the other that has
  as many fruits on it as possible. this should be called
  after we have initialized or updated the fruit locations.
   */
  chart_a_path : function (start, end, fuel) {
    var canonical_box_rep = coordinate_functions.box_coordinates_from_endpoints(start, end);
    var fruit_locations_in_box = this.fruits_in_a_box(canonical_box_rep.left, canonical_box_rep.right);
  }
};

/* this should work while I figure out a better way to do this */
function create_strategy_instance(Constructor) {
  /* set prototype and create an instance. */
  Constructor.prototype = common_strategy_methods;
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