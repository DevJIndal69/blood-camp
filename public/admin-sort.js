(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.AdminDonorSort = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const API_SORT = Object.freeze({ createdAt: -1, _id: -1 });

  function compareIds(left, right) {
    return String(left._id).localeCompare(String(right._id));
  }

  function parseCreatedAt(donor) {
    if (donor.createdAt == null) {
      return null;
    }

    const timestamp = Date.parse(donor.createdAt);
    return Number.isNaN(timestamp) ? null : timestamp;
  }

  function compareDates(left, right, direction) {
    const leftTimestamp = parseCreatedAt(left);
    const rightTimestamp = parseCreatedAt(right);

    if (leftTimestamp === null && rightTimestamp !== null) {
      return 1;
    }
    if (leftTimestamp !== null && rightTimestamp === null) {
      return -1;
    }
    if (leftTimestamp !== rightTimestamp) {
      return direction * (leftTimestamp - rightTimestamp);
    }

    return direction * compareIds(left, right);
  }

  function compareNames(left, right) {
    const nameOrder = String(left.name).localeCompare(String(right.name), undefined, {
      sensitivity: 'base',
    });

    return nameOrder || compareIds(left, right);
  }

  function sortDonors(donors, mode = 'latest') {
    const comparator =
      mode === 'oldest'
        ? (left, right) => compareDates(left, right, 1)
        : mode === 'name'
          ? compareNames
          : (left, right) => compareDates(left, right, -1);

    return donors.slice().sort(comparator);
  }

  return { API_SORT, sortDonors };
});
