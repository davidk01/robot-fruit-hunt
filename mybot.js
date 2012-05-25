/* 
this should serve as a prototype for other strategy constructors. 
requires the constructor of the strategy that wants to use this as
a prototype to initialize fruit_locations and init. 
*/
var common_methods = {
   update_fruits: function(board) {
      var acc = [];
      for (var i = 0, l = this.fruit_locations.length; i < l; i++) {
         var location = this.fruit_locations[i];
         var item = board[location[0]][location[1]];
         if (item) {
            acc.push(location);
         }
      }
      this.fruit_locations = acc;
   },
   find_fruits: function(board) {
      for (var col_index = 0; col_index < WIDTH; col_index++) {
         var column = board[col_index];
         for (var row_index = 0; row_index < HEIGHT; row_index++) {
            if (column[row_index]) {
               this.fruit_locations.push([col_index, row_index]);
            }
         }
      }
   },
   manhattan_metric: function(from, to) {
      return Math.abs(from[0] - to[0]) + Math.abs(from[1] - to[1]);
   },
   calculate_move: function(move_location, my_location) {
      // figure out if we need to move left or right
      var x_delta = move_location[0] - my_location[0];
      if (x_delta > 0) {
         return EAST;
      } else if (x_delta < 0) {
         return WEST;
      }
      // figure out if we need to move left or right
      var y_delta = move_location[1] - my_location[1];
      if (y_delta > 0) {
         return SOUTH;
      } else if (y_delta < 0) {
         return NORTH;
      }
   },
   init_or_update_fruit_locations: function(board) {
      if (!this.init) {
         this.find_fruits(board);
         this.init = true;
      } else {
         this.update_fruits(board);
      }      
   }
};

/* this should work while I figure out a better way to do this */
function create_strategy_instance(constructor) {
   constructor.prototype = common_methods;
   var instance = new constructor();
   instance.init = false;
   instance.fruit_locations = [];
   return instance;
}

/* 
simple greedy strategy for getting to the closest fruit.
does not take the opponent's location into account when
making decisions. so if an enemy is closer to a fruit than us
then this will not affect our decision making and we will move
towards a location that will be empty before we get there.
*/
function Closest_Fruit_Strategy() {
   /* entry point for strategy */
   this.make_move = function(board) {
      var my_x = get_my_x(), my_y = get_my_y();
      if (board[my_x][my_y] > 0) {
          return TAKE;
      }
      this.init_or_update_fruit_locations(board);
      var closest_fruit_location = this.find_closest_fruit_location_from(my_x, my_y);
      if (closest_fruit_location == null) {
         return PASS;
      }
      return this.calculate_move(closest_fruit_location, [my_x, my_y]);
   };
   /* auxiliary functionality specific to this strategy */
   this.find_closest_fruit_location_from = function(x, y) {
      var closest = null;
      var min_distance = Infinity;
      var metric = this.manhattan_metric;
      this.fruit_locations.forEach(function(location) {
         var distance = metric([x, y], location);
         if (distance <= min_distance) {
            closest = location;
            min_distance = distance;
         }
      });
      return closest;
   };
}

/* similar to closest fruit strategy but now tries to avoid
moving towards fruit that are likely to be nabbed by an opponent.
opponent nabbing fruit is determined by figuring out if the opponent
is closer than us to the fruit.
*/
function Avoid_Fruit_Close_To_Enemy_Strategy() {
   /* the entry point for the strategy */
   this.make_move = function(board) {
      var my_x = get_my_x(), my_y = get_my_y();
      if (board[my_x][my_y] > 0) {
         return TAKE;
      }
      var enemy_x = get_opponent_x(), enemy_y = get_opponent_y();
      this.init_or_update_fruit_locations(board);
      var move_location = this.next_potential_fruit_location([enemy_x, enemy_y], [my_x, my_y]);
      if (move_location == null) {
         return PASS;
      }
      return this.calculate_move(move_location, [my_x, my_y]);
   };
   /* auxiliary methods */
   this.next_potential_fruit_location = function(enemy_location, my_location) {
      var good_location = null;
      var metric = this.manhattan_metric;
      var min_distance = Infinity;
      var location_distances = this.fruit_locations.map(function(location) {
         var enemy_distance = metric(enemy_location, location);
         var my_distance = metric(my_location, location);
         return [location, my_distance, enemy_distance];
      });
      location_distances.sort(function(a,b) {
         return (a[1] + a[2] - b[1] + b[2]);
      });
      return location_distances[0];
   };
}

var strategy;
function new_game() {
   strategy = create_strategy_instance(Avoid_Fruit_Close_To_Enemy_Strategy);
}

function make_move() {
   return strategy.make_move(get_board());
}
