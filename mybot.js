/**
 * Serves as a namespace for functions that deal with grid
 * coordinates but don't do any kind of path finding.
 * @type {Object}
 */
var coordinate_functions = {
  /**
   * The taxicab metric for a 2d grid of points.
   * @param from The starting position.
   * @param to The ending position.
   * @return {Number} The distance from the starting position to the ending position.
   */
  manhattan_metric : function (from, to) {
    return Math.abs(from[0] - to[0]) + Math.abs(from[1] - to[1]);
  },
  /**
   * the start and end points can be in the following configurations:
   * s  +  o      o  -  s      o  +  e      e  -  o                              s      e
   * 1) +     +  2)  +     +  3)  -     -  4)  -     -  5)  s  +  e  6)  e - s  7)  +  8)  -
   * o  +  e      e  -  o      s  +  o      o  -  s                              e      s
   * we want to return coordinates that will make the box look like:
   * l  #  o
   * #     #  or   l # r
   * o  #  r
   * because we don't really care about how the path from start to end
   * is oriented.
   * @param start The starting point of the path.
   * @param end The ending point of the path.
   * @returns {Object} An object with "left", "right" properties that contains the
   * non-oriented coordinates.
   */
  box_coordinates_from_endpoints : function (start, end) {
    var col_delta = end[0] - start[0], row_delta = end[1] - start[1];
    var orientation = col_delta * row_delta;
    if (orientation === 0) { /* degenerate case of horizontal or vertical line or a single point*/
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
  },
  /**
   * Given coordinates of a bounding box and some nodes we figure
   * out which ones fit in that box and return them.
   * @param box_coords An object with "left", "right" properties that
   * contains the coordinates of the top left and bottom right end points
   * of the bounding box.
   * @param nodes The set of initial nodes we want to filter down to ones
   * that are contained in the bounding box.
   * @returns {Array} The list of nodes contained in the bounding box
   */
  nodes_in_box : function(box_coords, nodes, extra_filter) {
    if (!extra_filter) {
      extra_filter = function (node) { return true; };
    }
    var left_col_limit = box_coords.left[0], right_col_limit = box_coords.right[0];
    var top_row_limit = box_coords.left[1], bottom_row_limit = box_coords.right[1];
    return nodes.filter(function (node) {
      /* check column limits */
      if (node[0] >= left_col_limit && node[0] <= right_col_limit) {
        /* check row limits */
        if (node[1] >= top_row_limit && node[1] <= bottom_row_limit) {
          return extra_filter(node);
        }
      }
      return false;
    });
  }
};

/**
 * Serves as the namespace for functions that do something with paths
 * from one endpoint to another.
 * @type {Object}
 */
var path_construction = {
  /* utility for merging two objects.
  whatever is in b will override whatever is in a
  if one key exists in both objects.
  */
  merge : function (a, b) {
    for (var k in b) {
      a[k] = b[k];
    }
  },
  /**
   * Given a start and end points along with nodes we want to pass through
   * we construct the paths that only pass through those nodes and no more.
   * @param start The initial point for the set of paths we want to construct.
   * @param end The terminal point for the set of paths.
   * @param nodes The set of points we want our paths to go through. The assumption
   * is that these nodes are contained in the box defined by the start and end points.
   * This array should contain all accessible nodes except the starting point. Accessible
   * means that the end point should be included in this array.
   * @returns {Array} The set of paths given as a set of ordered points.
   */
  construct_restricted_paths : function(start, end, nodes) {
    /* construct a reachability graph and refine it */
    var initial_graph = {}; initial_graph[start] = nodes;
    var refined_data = this.single_refinement_step(end, nodes);
    var refined_graph = refined_data.graph;
    var need_further_refinement = Object.keys(refined_graph);
    /* base case */
    if (need_further_refinement.length === 0) {
      return initial_graph;
    }
    /* recursive case */
    initial_graph[start] = refined_data.filtered_nodes;
    need_further_refinement.map(function (node) {
      return this.construct_restricted_paths(node, end, refined_graph[node]);
    }, this).forEach(function (graph) { this.merge(initial_graph, graph); }, this);
    return initial_graph;
  },
  /*
  Given a destination point and a set of already reachable nodes we refine
  it so that all nodes reachable in two steps disappear from this list and instead
  go into a seperate graph.
  */
  single_refinement_step : function(end, reachable_nodes) {
    var cache_hit;
    if (cache_hit = this.single_refinement_step_cache[[end, reachable_nodes]]) {
      return cache_hit;
    }
    var refinement = this.refine(end, reachable_nodes);
    var reachable_in_two_steps = refinement.reachable_in_two_steps;
    var filtered_nodes = reachable_nodes.filter(function (node) { return !reachable_in_two_steps[node]; });
    var refined_data = {filtered_nodes : filtered_nodes, graph : refinement.refined_graph};
    return this.single_refinement_step_cache[[end, reachable_nodes]] = refined_data;
  },
  /*
  this is where most of the work for refinement happens. hard to explain without drawing a picture
  */
  refine : function (end, nodes) {
    var reachable_nodes = {}, accumulator = {};
    nodes.forEach(function (node) {
      var box_coords = coordinate_functions.box_coordinates_from_endpoints(node, end);
      var filter = function (n) { return n[0] !== node[0] || n[1] !== node[1]; };
      var refined_nodes = coordinate_functions.nodes_in_box(box_coords, nodes, filter);
      if (refined_nodes.length > 0) {
        refined_nodes.forEach(function (node) { reachable_nodes[node] = true; });
        accumulator[node] = refined_nodes;
      }
    });
    return {reachable_in_two_steps : reachable_nodes, refined_graph : accumulator};
  },
  /* used to cache computations carried out by single_refinement_step */
  single_refinement_step_cache : {}
};

/**
 * this should serve as a prototype for other strategy constructors.
 * requires the constructor of the strategy that wants to use this as
 * a prototype to initialize fruit_locations and init.
 * @type {Object}
 */
var common_strategy_methods = {
  /**
   * similar to find_fruits but instead of going through each cell of the board
   * we only check the locations that we know had fruit to begin with.
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
  /**
   * go through the board and save all the fruit locations.
   * also, while making a pass through the board we keep
   * track of how many fruits of that type we would need to
   * get in order to win that category.
   * @param board Column major grid that contains cells with fruits.
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
  /**
   * The game has a predefined set of constants for directional movement.
   * So given where we want to move and some other location this function
   * returns one of the direction specifiers that will get us closer to
   * the desired location.
   * @param move_location Where we want to move.
   * @param my_location Where we want to move from.
   * @return {*}
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
  /**
   * Convenience function for updating fruit locations. This
   * should be called on every turn of the game to update the
   * locations of the fruits.
   * @param board Column major grid that contains cells with fruit types.
   */
  init_or_update_fruit_locations : function (board) {
    if (!this.init) {
      this.find_fruits_and_compute_win_counts(board);
      this.init = true;
    } else {
      this.update_fruits(board);
    }
  },
  /**
   * Finds the closest fruit to a given location. Will throw
   * an exception or return null if fruit_stash and fruit_stash.fruits
   * don't contain anything. So this function will only return sensible
   * results if our fruit_stash is sane.
   * @param loc The location that is going to serve as the center of our search
   * for the closest fruit.
   * @return {*} The location of the closest fruit. Note that this is not unique.
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
  }
};

/**
 * Initializes strategy instances given a constructor that creates
 * an object instance that conforms to the game API.
 * @param Constructor A constructor that returns an instance of a strategy that conforms to the game API.
 * @return {Object} An instance that has its prototype linked to common_strategy_methods and
 * has various properties initialized to what is expected by the methods in common_strategy_methods.
 */
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

/**
 * Constructor for a greedy strategy that tries to ignore
 * fruits that are obviously won or lost.
 * @constructor
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

var strategy;
/**
 * Called every time a new game starts. Currently it creates a new
 * strategy instance every time this function is called.
 */
function new_game() {
  strategy = create_strategy_instance(Still_Pretty_Greedy);
}

/**
 * The function required by the game API. It just delegates to
 * the make_move method of the strategy instance created by new_game.
 * @return {*}
 */
function make_move() {
  return strategy.make_move(get_board());
}